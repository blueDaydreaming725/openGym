/**
 * 计划模板：分化（2/3/4/5）、力量（卧推 5/3/1）、减脂（有氧+力量）
 * 来源：docs/research/domain-notes.md §1/§2/§4
 * 模板只是"默认推荐"——开始训练前用户可增删替换动作（SessionExerciseItem）。
 */
import type { Cycle, TrainingPlan, Workout, WorkoutItem } from '../types/models'
import { EXERCISE_LIBRARY } from './exercise-library'

let idCounter = 0
export function genId(prefix: string): string {
  idCounter++
  return `${prefix}_${Date.now().toString(36)}_${idCounter}_${Math.random().toString(36).slice(2, 6)}`
}

/** 从动作库取动作（模板里写 id，确保与库一致） */
function item(
  exerciseId: string,
  sets: number,
  repMin: number,
  repMax?: number,
  weightKg?: number,
): WorkoutItem {
  const ex = EXERCISE_LIBRARY.find(e => e.id === exerciseId)
  return {
    exerciseId,
    sets,
    repRangeMin: repMin,
    repRangeMax: repMax ?? repMin,
    targetWeightKg: weightKg,
    restSeconds: ex?.defaultRestSeconds ?? 90,
  }
}

function workout(name: string, items: WorkoutItem[]): Workout {
  return { id: genId('wo'), name, items }
}

export interface SplitPlanSpec {
  splitKind: 2 | 3 | 4 | 5
  name: string
  /** 各动作默认起始重量（kg），用户可在创建时修改 */
  weights?: Partial<Record<string, number>>
}

/** 二/三/四/五分化模板（每周期 = N 练 1 休） */
export function buildSplitPlan(spec: SplitPlanSpec): TrainingPlan {
  const w = (id: string) => spec.weights?.[id]
  let sessions: Workout[]

  if (spec.splitKind === 2) {
    // 上下肢分化：2 练 1 休
    sessions = [
      workout('上肢日', [
        item('ex-bench-press', 4, 8, 10, w('ex-bench-press') ?? 40),
        item('ex-barbell-row', 4, 8, 10, w('ex-barbell-row') ?? 40),
        item('ex-ohp', 3, 8, 10, w('ex-ohp') ?? 25),
        item('ex-lat-pulldown', 3, 10, 12, w('ex-lat-pulldown') ?? 40),
        item('ex-barbell-curl', 3, 10, 12, w('ex-barbell-curl') ?? 15),
        item('ex-tricep-pushdown', 3, 10, 12, w('ex-tricep-pushdown') ?? 20),
      ]),
      workout('下肢日', [
        item('ex-squat', 4, 6, 8, w('ex-squat') ?? 50),
        item('ex-rdl', 3, 8, 10, w('ex-rdl') ?? 50),
        item('ex-leg-press', 3, 10, 12, w('ex-leg-press') ?? 80),
        item('ex-leg-curl', 3, 10, 12, w('ex-leg-curl') ?? 30),
        item('ex-calf-raise', 4, 12, 15, w('ex-calf-raise') ?? 40),
        item('ex-plank', 3, 30, 60),
      ]),
    ]
  } else if (spec.splitKind === 3) {
    // 推拉腿：3 练 1 休
    sessions = [
      workout('推（胸肩三头）', [
        item('ex-bench-press', 4, 6, 8, w('ex-bench-press') ?? 40),
        item('ex-incline-db-press', 3, 8, 10, w('ex-incline-db-press') ?? 14),
        item('ex-ohp', 3, 8, 10, w('ex-ohp') ?? 25),
        item('ex-lateral-raise', 4, 12, 15, w('ex-lateral-raise') ?? 6),
        item('ex-tricep-pushdown', 3, 10, 12, w('ex-tricep-pushdown') ?? 20),
        item('ex-overhead-ext', 3, 10, 12, w('ex-overhead-ext') ?? 8),
      ]),
      workout('拉（背二头）', [
        item('ex-deadlift', 3, 5, 6, w('ex-deadlift') ?? 60),
        item('ex-pull-up', 4, 6, 10),
        item('ex-barbell-row', 3, 8, 10, w('ex-barbell-row') ?? 40),
        item('ex-seated-row', 3, 10, 12, w('ex-seated-row') ?? 40),
        item('ex-face-pull', 3, 12, 15, w('ex-face-pull') ?? 15),
        item('ex-hammer-curl', 3, 10, 12, w('ex-hammer-curl') ?? 10),
      ]),
      workout('腿', [
        item('ex-squat', 4, 6, 8, w('ex-squat') ?? 50),
        item('ex-rdl', 3, 8, 10, w('ex-rdl') ?? 50),
        item('ex-leg-press', 3, 10, 12, w('ex-leg-press') ?? 80),
        item('ex-leg-curl', 3, 10, 12, w('ex-leg-curl') ?? 30),
        item('ex-calf-raise', 4, 12, 15, w('ex-calf-raise') ?? 40),
      ]),
    ]
  } else if (spec.splitKind === 4) {
    // 胸 / 背 / 腿 / 肩臂：4 练 1 休
    sessions = [
      workout('胸', [
        item('ex-bench-press', 4, 6, 8, w('ex-bench-press') ?? 40),
        item('ex-incline-db-press', 4, 8, 10, w('ex-incline-db-press') ?? 14),
        item('ex-db-fly', 3, 10, 12, w('ex-db-fly') ?? 8),
        item('ex-cable-crossover', 3, 12, 15, w('ex-cable-crossover') ?? 10),
      ]),
      workout('背', [
        item('ex-deadlift', 3, 5, 6, w('ex-deadlift') ?? 60),
        item('ex-pull-up', 4, 6, 10),
        item('ex-barbell-row', 4, 8, 10, w('ex-barbell-row') ?? 40),
        item('ex-seated-row', 3, 10, 12, w('ex-seated-row') ?? 40),
      ]),
      workout('腿', [
        item('ex-squat', 4, 6, 8, w('ex-squat') ?? 50),
        item('ex-rdl', 3, 8, 10, w('ex-rdl') ?? 50),
        item('ex-leg-press', 4, 10, 12, w('ex-leg-press') ?? 80),
        item('ex-leg-curl', 3, 10, 12, w('ex-leg-curl') ?? 30),
        item('ex-calf-raise', 4, 12, 15, w('ex-calf-raise') ?? 40),
      ]),
      workout('肩 + 手臂', [
        item('ex-ohp', 4, 6, 8, w('ex-ohp') ?? 25),
        item('ex-lateral-raise', 4, 12, 15, w('ex-lateral-raise') ?? 6),
        item('ex-rear-delt-fly', 3, 12, 15, w('ex-rear-delt-fly') ?? 5),
        item('ex-barbell-curl', 3, 10, 12, w('ex-barbell-curl') ?? 15),
        item('ex-tricep-pushdown', 3, 10, 12, w('ex-tricep-pushdown') ?? 20),
      ]),
    ]
  } else {
    // 五分化：胸/背/肩/腿/手臂，5 练 1 休（辅助交叉在复盘提示中说明）
    sessions = [
      workout('胸', [
        item('ex-bench-press', 5, 5, 8, w('ex-bench-press') ?? 40),
        item('ex-incline-db-press', 4, 8, 10, w('ex-incline-db-press') ?? 14),
        item('ex-cable-crossover', 4, 12, 15, w('ex-cable-crossover') ?? 10),
      ]),
      workout('背', [
        item('ex-pull-up', 4, 6, 10),
        item('ex-barbell-row', 4, 8, 10, w('ex-barbell-row') ?? 40),
        item('ex-lat-pulldown', 4, 10, 12, w('ex-lat-pulldown') ?? 40),
        item('ex-face-pull', 3, 15, 20, w('ex-face-pull') ?? 15),
      ]),
      workout('肩', [
        item('ex-ohp', 4, 6, 8, w('ex-ohp') ?? 25),
        item('ex-lateral-raise', 5, 12, 15, w('ex-lateral-raise') ?? 6),
        item('ex-rear-delt-fly', 4, 12, 15, w('ex-rear-delt-fly') ?? 5),
      ]),
      workout('腿', [
        item('ex-squat', 5, 5, 8, w('ex-squat') ?? 50),
        item('ex-rdl', 4, 8, 10, w('ex-rdl') ?? 50),
        item('ex-leg-press', 4, 10, 12, w('ex-leg-press') ?? 80),
        item('ex-calf-raise', 5, 12, 15, w('ex-calf-raise') ?? 40),
      ]),
      workout('手臂 + 核心', [
        item('ex-barbell-curl', 4, 10, 12, w('ex-barbell-curl') ?? 15),
        item('ex-hammer-curl', 3, 10, 12, w('ex-hammer-curl') ?? 10),
        item('ex-tricep-pushdown', 4, 10, 12, w('ex-tricep-pushdown') ?? 20),
        item('ex-overhead-ext', 3, 10, 12, w('ex-overhead-ext') ?? 8),
        item('ex-hanging-leg-raise', 3, 10, 15),
      ]),
    ]
  }

  const cycle: Cycle = {
    id: genId('cyc'),
    planId: '',
    name: '第 1 周期',
    order: 1,
    durationWeeks: 1,
    workouts: sessions,
  }

  return {
    id: genId('plan'),
    name: spec.name,
    type: 'split',
    splitKind: spec.splitKind,
    trainDaysPerCycle: spec.splitKind,
    restDaysPerCycle: 1,
    restDays: [],
    cycles: [cycle],
  }
}

export interface BenchPlanSpec {
  /** 卧推 1RM（kg），训练上限 = 1RM × 90% */
  bench1rmKg: number
}

/** 力量计划：卧推 5/3/1（4 周周期：5×5+ / 3×3+ / 5/3/1+ / 减载） */
export function buildBenchPlan(spec: BenchPlanSpec): TrainingPlan {
  const tm = Math.round(spec.bench1rmKg * 0.9 * 4) / 4 // 训练上限
  const pct = (p: number) => Math.round(tm * p * 2) / 2

  const mainWork = (week: 1 | 2 | 3 | 4): WorkoutItem[] => {
    const table: Record<1 | 2 | 3 | 4, Array<[number, number]>> = {
      1: [[65, 5], [75, 5], [85, 5]],
      2: [[70, 3], [80, 3], [90, 3]],
      3: [[75, 5], [85, 3], [95, 1]],
      4: [[40, 5], [50, 5], [60, 5]],
    }
    return table[week].map(([p, reps]) =>
      item('ex-bench-press', 1, reps, reps, pct(p)),
    )
  }

  const sessions: Workout[] = ([1, 2, 3, 4] as const).map(week => {
    const name = week === 4 ? '卧推日 · 减载周' : `卧推日 · 第${week}周（5/3/1）`
    return workout(name, [
      ...mainWork(week),
      item('ex-incline-db-press', 3, 8, 10, Math.round(tm * 0.5)),
      item('ex-lateral-raise', 3, 12, 15, Math.round(tm * 0.15)),
      item('ex-tricep-pushdown', 3, 10, 12, Math.round(tm * 0.4)),
    ])
  })

  const cycle: Cycle = {
    id: genId('cyc'),
    planId: '',
    name: '5/3/1 周期',
    order: 1,
    durationWeeks: 4,
    workouts: sessions,
  }

  return {
    id: genId('plan'),
    name: `卧推 5/3/1（训练上限 ${tm}kg）`,
    type: 'strength',
    trainDaysPerCycle: 4,
    restDaysPerCycle: 0,
    restDays: [],
    cycles: [cycle],
    note: '最后一组按目标次数做到 AMRAP（留 1-2 次余量），训练上限每周期 +2.5kg',
  }
}

/** 减脂计划：3 练（保留力量）+ 3 次有氧，一周期一周 */
export function buildFatlossPlan(weights?: Partial<Record<string, number>>): TrainingPlan {
  const w = (id: string) => weights?.[id]
  const sessions: Workout[] = [
    workout('全身力量 A', [
      item('ex-squat', 3, 8, 10, w('ex-squat') ?? 50),
      item('ex-bench-press', 3, 8, 10, w('ex-bench-press') ?? 40),
      item('ex-barbell-row', 3, 8, 10, w('ex-barbell-row') ?? 40),
      item('ex-lateral-raise', 3, 12, 15, w('ex-lateral-raise') ?? 6),
      item('ex-plank', 3, 40, 60),
    ]),
    workout('全身力量 B', [
      item('ex-rdl', 3, 8, 10, w('ex-rdl') ?? 50),
      item('ex-incline-db-press', 3, 8, 10, w('ex-incline-db-press') ?? 14),
      item('ex-lat-pulldown', 3, 10, 12, w('ex-lat-pulldown') ?? 40),
      item('ex-lunge', 3, 10, 12, w('ex-lunge') ?? 10),
      item('ex-hanging-leg-raise', 3, 10, 15),
    ]),
    workout('全身力量 C', [
      item('ex-deadlift', 3, 5, 6, w('ex-deadlift') ?? 60),
      item('ex-ohp', 3, 8, 10, w('ex-ohp') ?? 25),
      item('ex-seated-row', 3, 10, 12, w('ex-seated-row') ?? 40),
      item('ex-leg-curl', 3, 10, 12, w('ex-leg-curl') ?? 30),
      item('ex-calf-raise', 3, 12, 15, w('ex-calf-raise') ?? 40),
    ]),
    workout('有氧 LISS ①', [item('ex-treadmill-walk', 1, 30, 45)]),
    workout('有氧 LISS ②', [item('ex-cycling', 1, 30, 45)]),
    workout('有氧 LISS ③', [item('ex-rowing', 1, 20, 30)]),
  ]

  const cycle: Cycle = {
    id: genId('cyc'),
    planId: '',
    name: '第 1 周期（周）',
    order: 1,
    durationWeeks: 1,
    workouts: sessions,
  }

  return {
    id: genId('plan'),
    name: '减脂计划（3 力量 + 3 有氧）',
    type: 'fatloss',
    trainDaysPerCycle: 6,
    restDaysPerCycle: 1,
    restDays: [],
    cycles: [cycle],
    note: '热量缺口 = TDEE - 300~500 kcal；每周减重 0.5-1%；力量重量尽量不掉',
  }
}
