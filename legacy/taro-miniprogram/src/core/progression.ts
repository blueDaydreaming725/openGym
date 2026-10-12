/**
 * 进阶规则引擎（纯函数，无平台依赖，云函数/小程序同构复用）
 * 参考文档：docs/research/domain-notes.md §2/§3
 * 安全护栏（guardrails）是 agent 方案的兜底层，agent 输出必须经过这里校验。
 */
import type { SessionRecord, WorkoutItem } from '../types/models'

/** 1RM 估算公式 */
export type OneRmFormula = 'epley' | 'brzycki'

/** Epley：1RM = w × (1 + reps/30) */
export function estimate1RM(
  weightKg: number,
  reps: number,
  formula: OneRmFormula = 'epley',
): number {
  if (weightKg <= 0 || reps <= 0) return 0
  if (formula === 'brzycki') {
    return reps >= 37 ? weightKg : weightKg * (36 / (37 - reps))
  }
  return weightKg * (1 + reps / 30)
}

/** %1RM - 次数对照（用于目标合理性校验）：给定 %1RM 可完成的参考次数 */
export function repsAtPercent(percent: number): number {
  // 近似：90%≈4、85%≈6、80%≈8、75%≈10、70%≈12
  const table: Array<[number, number]> = [
    [95, 2], [90, 4], [85, 6], [80, 8], [75, 10], [70, 12], [65, 15],
  ]
  for (const [p, r] of table) {
    if (percent >= p) return r
  }
  return 20
}

// ── 安全护栏 ──────────────────────────────────────────────

export interface GuardrailRules {
  /** 单周期单动作最大加重百分比 */
  maxIncreasePct: number
  /** 单周期单动作最大加重公斤数 */
  maxIncreaseKg: number
  /** 触发减载的连续未完成周期数 */
  consecutiveFailLimit: number
  /** 减载幅度（百分比） */
  deloadPct: number
}

export const DEFAULT_GUARDRAILS: GuardrailRules = {
  maxIncreasePct: 0.05,
  maxIncreaseKg: 2.5,
  consecutiveFailLimit: 2,
  deloadPct: 0.1,
}

export type AdjustAction = 'increase' | 'hold' | 'reduce' | 'replace'

/** 单个动作的下周期调整提案 */
export interface ExerciseAdjustment {
  exerciseId: string
  action: AdjustAction
  /** 建议重量（increase/reduce/hold 时给出） */
  nextWeightKg?: number
  /** 当前重量 */
  currentWeightKg?: number
  /** 替换为动作（action === 'replace' 时） */
  replaceWithExerciseId?: string
  /** 规则依据（人可读） */
  reason: string
  /** 是否被护栏强制修改过（记录原提案） */
  overridden?: { originalAction: AdjustAction; originalWeightKg?: number; rule: string }
}

/** 一个动作在本周期的表现聚合 */
export interface ExerciseCyclePerformance {
  exerciseId: string
  /** 计划组次（来自模板） */
  target: Pick<WorkoutItem, 'sets' | 'repRangeMin' | 'repRangeMax' | 'targetWeightKg'>
  /** 实际完成的所有组 */
  sets: Array<{ weightKg: number; reps: number; rpe?: number }>
  /** 计划训练次数（该动作在周期内出现的次数） */
  plannedSessions: number
  /** 实际训练次数 */
  actualSessions: number
  /** 关节疼痛等异常标注 */
  painFlagged?: boolean
}

/** 从周期内所有训练记录中聚合出每个动作的表现 */
export function aggregateCyclePerformance(
  records: SessionRecord[],
  targetByExercise: Map<string, WorkoutItem>,
  plannedSessionsByExercise: Map<string, number>,
): ExerciseCyclePerformance[] {
  const map = new Map<string, ExerciseCyclePerformance>()
  for (const rec of records) {
    for (const ex of rec.exercises) {
      const entry = map.get(ex.exerciseId) ?? {
        exerciseId: ex.exerciseId,
        target: targetByExercise.get(ex.exerciseId) ?? {
          sets: 0, repRangeMin: undefined, repRangeMax: undefined, targetWeightKg: undefined,
        },
        sets: [],
        plannedSessions: plannedSessionsByExercise.get(ex.exerciseId) ?? 0,
        actualSessions: 0,
      }
      entry.sets.push(...ex.sets)
      entry.actualSessions++
      map.set(ex.exerciseId, entry)
    }
  }
  return Array.from(map.values())
}

/** 完成率：完成组数 / 计划组数（按周期内所有训练求和） */
export function completionRate(perf: ExerciseCyclePerformance[]): number {
  const planned = perf.reduce((s, p) => s + p.target.sets * p.plannedSessions, 0)
  if (planned === 0) return 0
  const done = perf.reduce((s, p) => s + p.sets.length, 0)
  return Math.min(1, done / planned)
}

/** 平均 RPE（无 RPE 数据的组不计入） */
export function averageRpe(records: SessionRecord[]): number | undefined {
  const rpes: number[] = []
  for (const rec of records) {
    for (const ex of rec.exercises) {
      for (const set of ex.sets) {
        if (typeof set.rpe === 'number') rpes.push(set.rpe)
      }
    }
  }
  if (rpes.length === 0) return undefined
  return rpes.reduce((a, b) => a + b, 0) / rpes.length
}

/** 找该动作本周期用过的最大重量 */
function topWeight(perf: ExerciseCyclePerformance): number {
  return perf.sets.reduce((m, s) => Math.max(m, s.weightKg), 0)
}

/** 末组平均 RPE（判断余量） */
function lastSetRpe(perf: ExerciseCyclePerformance): number | undefined {
  if (perf.sets.length === 0) return undefined
  const lastSets = perf.sets.slice(-3)
  const rpes = lastSets.map(s => s.rpe).filter((r): r is number => typeof r === 'number')
  if (rpes.length === 0) return undefined
  return rpes.reduce((a, b) => a + b, 0) / rpes.length
}

/**
 * 规则版周期决策（M1 引擎；M2 中 agent 提案也须经 applyGuardrails 校验）
 * 规则来源：domain-notes.md §3 决策表
 */
export function ruleBasedAdjustment(
  perf: ExerciseCyclePerformance[],
  exerciseSteps: Map<string, number>,
  guardrails: GuardrailRules = DEFAULT_GUARDRAILS,
): ExerciseAdjustment[] {
  const rate = completionRate(perf)
  return perf.map((p) => {
    const current = p.target.targetWeightKg ?? topWeight(p) ?? 0
    const stepKg = exerciseSteps.get(p.exerciseId) ?? 2.5
    const rpe = lastSetRpe(p)

    // 护栏优先：疼痛 → 强制替换
    if (p.painFlagged) {
      return {
        exerciseId: p.exerciseId,
        action: 'replace',
        currentWeightKg: current,
        reason: '出现疼痛标注，强制替换动作并建议就医评估',
      }
    }
    // 全部完成且余量充足 → 加重
    if (rate >= 0.99 && rpe !== undefined && rpe <= 8) {
      const next = Math.round((current + stepKg) * 4) / 4
      return {
        exerciseId: p.exerciseId,
        action: 'increase',
        currentWeightKg: current,
        nextWeightKg: next,
        reason: `全部完成且末组 RPE≤8，按步长 +${stepKg}kg`,
      }
    }
    // 全部完成但接近力竭 → 重量不变巩固
    if (rate >= 0.99) {
      return {
        exerciseId: p.exerciseId,
        action: 'hold',
        currentWeightKg: current,
        reason: `完成良好但末组 RPE 偏高（${rpe?.toFixed(1)}），同重量重复巩固`,
      }
    }
    // 部分完成 → 重复并减量
    if (rate >= 0.8) {
      return {
        exerciseId: p.exerciseId,
        action: 'hold',
        currentWeightKg: current,
        reason: `完成率 ${(rate * 100).toFixed(0)}%，同重量重复，每周减 1 组`,
      }
    }
    // 大面积未完成 → 减载
    const next = Math.round(current * (1 - guardrails.deloadPct) * 4) / 4
    return {
      exerciseId: p.exerciseId,
      action: 'reduce',
      currentWeightKg: current,
      nextWeightKg: next,
      reason: `完成率 ${(rate * 100).toFixed(0)}% < 80%，减载 ${(guardrails.deloadPct * 100).toFixed(0)}%`,
    }
  })
}

/** 护栏校验：agent 提案必须过这一关才能展示给用户 */
export function applyGuardrails(
  adjustments: ExerciseAdjustment[],
  guardrails: GuardrailRules = DEFAULT_GUARDRAILS,
): ExerciseAdjustment[] {
  return adjustments.map((adj) => {
    if (adj.action !== 'increase' || adj.currentWeightKg == null || adj.nextWeightKg == null) {
      return adj
    }
    const delta = adj.nextWeightKg - adj.currentWeightKg
    const maxKg = Math.min(
      guardrails.maxIncreaseKg,
      adj.currentWeightKg * guardrails.maxIncreasePct,
    )
    if (delta > maxKg + 1e-9) {
      const capped = Math.round((adj.currentWeightKg + maxKg) * 4) / 4
      return {
        ...adj,
        nextWeightKg: capped,
        overridden: {
          originalAction: adj.action,
          originalWeightKg: adj.nextWeightKg,
          rule: `单周期加重上限：≤ ${guardrails.maxIncreasePct * 100}% 且 ≤ ${guardrails.maxIncreaseKg}kg`,
        },
        reason: `${adj.reason}（护栏：加重 ${delta.toFixed(1)}kg → ${maxKg.toFixed(1)}kg）`,
      }
    }
    return adj
  })
}

/** 减载判定：连续 N 个周期同一动作 reduce → 触发动作替换建议 */
export function shouldSwitchExercise(recentCycleActions: AdjustAction[]): boolean {
  if (recentCycleActions.length < DEFAULT_GUARDRAILS.consecutiveFailLimit) return false
  const tail = recentCycleActions.slice(-DEFAULT_GUARDRAILS.consecutiveFailLimit)
  return tail.every(a => a === 'reduce')
}
