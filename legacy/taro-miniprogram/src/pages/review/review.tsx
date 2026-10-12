import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import './review.scss'
import {
  listPlans,
  listSessionRecords,
  savePlan,
  saveReview,
  getLatestReview,
} from '../../services/storage'
import { getExercise } from '../../core/exercise-library'
import {
  aggregateCyclePerformance,
  applyGuardrails,
  averageRpe,
  completionRate,
  DEFAULT_GUARDRAILS,
  ruleBasedAdjustment,
  type ExerciseAdjustment,
} from '../../core/progression'
import type { Workout } from '../../types/models'
import type { CycleReviewProposal } from '../../types/agent'
import type { TrainingPlan } from '../../types/models'

/** 周期复盘页：规则引擎产出周报卡片，用户逐项确认后生成下周期（M2 起 agent 接管产出） */
export default function Review() {
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const cycleId = router.params.cycleId ?? ''

  const [plan, setPlan] = useState<TrainingPlan>()
  const [summaryText, setSummaryText] = useState('')
  const [rate, setRate] = useState(0)
  const [rpe, setRpe] = useState<number>()
  const [sessionCount, setSessionCount] = useState(0)
  const [adjustments, setAdjustments] = useState<ExerciseAdjustment[]>([])
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [warnings, setWarnings] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void (async () => {
      const plans = await listPlans()
      const p = plans.find(x => x.id === planId)
      if (!p) {
        Taro.showToast({ title: '计划不存在', icon: 'error' })
        return
      }
      setPlan(p)
      const cycle = p.cycles.find(c => c.id === cycleId) ?? p.cycles[p.cycles.length - 1]

      // 已有确认过的复盘 → 直接展示，不重复生成
      const existing = await getLatestReview(cycle.id)
      if (existing?.confirmedAt) {
        applyProposal(existing)
        setLoaded(true)
        return
      }

      // 聚合本周期表现 → 规则引擎决策 → 护栏校验
      const records = await listSessionRecords(cycle.id)
      setSessionCount(records.length)

      const targetByExercise = new Map()
      const plannedSessions = new Map<string, number>()
      // 记录数可能超过一轮模板（练满未复盘继续练），计划量按轮数缩放
      const rounds = Math.max(1, Math.ceil(records.length / Math.max(1, cycle.workouts.length)))
      for (const wo of cycle.workouts) {
        for (const it of wo.items) {
          if (!targetByExercise.has(it.exerciseId)) {
            targetByExercise.set(it.exerciseId, it)
            plannedSessions.set(it.exerciseId, 0)
          }
          plannedSessions.set(it.exerciseId, (plannedSessions.get(it.exerciseId) ?? 0) + 1)
        }
      }
      for (const [k, v] of plannedSessions) plannedSessions.set(k, v * rounds)

      const perf = aggregateCyclePerformance(records, targetByExercise, plannedSessions)
      const trained = perf.filter(x => x.actualSessions > 0)
      const missing = perf.filter(x => x.actualSessions === 0)

      const steps = new Map(
        trained.map(t => [t.exerciseId, getExercise(t.exerciseId)?.stepKg ?? 2.5]),
      )
      const rateVal = completionRate(trained)
      const rpeVal = averageRpe(records)
      const raw = ruleBasedAdjustment(trained, steps, DEFAULT_GUARDRAILS)
      const final = applyGuardrails(raw, DEFAULT_GUARDRAILS)

      setRate(rateVal)
      setRpe(rpeVal)
      setAdjustments(final)
      setAccepted(new Set(final.map(a => a.exerciseId)))

      const warns: string[] = []
      if (records.length === 0) {
        warns.push('本周期还没有训练记录，建议先练再复盘')
      }
      if (missing.length > 0) {
        const names = missing
          .map(m => getExercise(m.exerciseId)?.name ?? m.exerciseId)
          .join('、')
        warns.push(`以下动作本周期未训练，不参与决策：${names}`)
      }
      setWarnings(warns)

      const tone =
        rateVal >= 0.95
          ? '完成度很高，执行到位'
          : rateVal >= 0.8
            ? '整体完成良好，有小幅缺口'
            : '完成度偏低，本周以巩固为主'
      setSummaryText(
        `本周期完成率 ${(rateVal * 100).toFixed(0)}%` +
        (rpeVal != null ? `，平均 RPE ${rpeVal.toFixed(1)}` : '') +
        `，${tone}。按规则：达标且余量足的动作加重；完成但接近力竭的同重量巩固；缺口大的减载修正。确认后即为下一周期的执行方案。`,
      )

      // 持久化提案（规则版；M2 起 source 变为 agent）
      const proposal: CycleReviewProposal = {
        id: `rev_${cycle.id}_${Date.now().toString(36)}`,
        cycleId: cycle.id,
        planId: p.id,
        source: 'rule-fallback',
        completionRate: rateVal,
        avgRpe: rpeVal,
        summaryText: '',
        rationale: final.map(a => a.reason),
        adjustments: final,
        warnings: warns,
        createdAt: new Date().toISOString(),
      }
      await saveReview(proposal)
      setLoaded(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, cycleId])

  function applyProposal(existing: CycleReviewProposal) {
    setRate(existing.completionRate)
    setRpe(existing.avgRpe)
    setSummaryText(existing.summaryText)
    setAdjustments(existing.adjustments)
    setAccepted(new Set(existing.adjustments.map(a => a.exerciseId)))
    setWarnings(existing.warnings)
    setConfirmed(true)
  }

  const bumpWeight = (adj: ExerciseAdjustment, delta: number) => {
    setAdjustments(prev =>
      prev.map(a =>
        a.exerciseId === adj.exerciseId && a.nextWeightKg != null
          ? {
              ...a,
              nextWeightKg: Math.max(0, Math.round((a.nextWeightKg + delta) * 4) / 4),
              overridden: a.overridden,
            }
          : a,
      ),
    )
  }

  const toggleAccept = (id: string) => {
    setAccepted(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** 确认：调整应用到下一周期（已预置则原地更新重量，未预置则新建） */
  const confirm = async () => {
    if (!plan) return
    const oldCycle = plan.cycles.find(c => c.id === cycleId) ?? plan.cycles[plan.cycles.length - 1]
    const adjMap = new Map(adjustments.filter(a => accepted.has(a.exerciseId)).map(a => [a.exerciseId, a]))

    const applyToWorkouts = (workouts: Workout[]) =>
      workouts.map(wo => ({
        ...wo,
        items: wo.items.map(it => {
          const adj = adjMap.get(it.exerciseId)
          if (!adj) return it
          if ((adj.action === 'increase' || adj.action === 'reduce') && adj.nextWeightKg != null) {
            return { ...it, targetWeightKg: adj.nextWeightKg }
          }
          return it
        }),
      }))

    const nextIdx = plan.cycles.findIndex(c => c.id === oldCycle.id) + 1
    const presetNext = plan.cycles[nextIdx]
    if (presetNext) {
      // 已预置下一周期（如旅行维持期）：只把接受的重量调整写进去
      const cycles = plan.cycles.map((c, i) =>
        i === nextIdx ? { ...c, workouts: applyToWorkouts(c.workouts) } : c,
      )
      await savePlan({ ...plan, cycles })
      Taro.showToast({ title: `已更新「${presetNext.name}」`, icon: 'success' })
      setTimeout(() => Taro.switchTab({ url: '/pages/training/plan' }), 800)
      return
    }

    const workouts = applyToWorkouts(oldCycle.workouts).map(wo => ({
      ...wo,
      id: `${wo.id}_n${oldCycle.order + 1}`,
    }))

    const nextCycle = {
      id: `cyc_${Date.now().toString(36)}`,
      planId: plan.id,
      name: `第 ${oldCycle.order + 1} 周期`,
      order: oldCycle.order + 1,
      durationWeeks: oldCycle.durationWeeks,
      endDate: oldCycle.endDate
        ? new Date(new Date(oldCycle.endDate).getTime() + oldCycle.durationWeeks * 7 * 86400000)
            .toISOString().slice(0, 10)
        : undefined,
      workouts,
    }
    await savePlan({ ...plan, cycles: [...plan.cycles, nextCycle] })

    // 标记提案已确认
    const existing = await getLatestReview(cycleId)
    if (existing) {
      await saveReview({ ...existing, confirmedAt: new Date().toISOString(), adjustments })
    }
    Taro.showToast({ title: `已生成 ${nextCycle.name}`, icon: 'success' })
    setTimeout(() => Taro.switchTab({ url: '/pages/training/plan' }), 800)
  }

  if (!loaded || !plan) {
    return (
      <View className='review-page'>
        <Text className='loading-hint'>生成周报中…</Text>
      </View>
    )
  }

  return (
    <View className='review-page'>
      <Text className='page-title'>周期复盘</Text>
      <Text className='page-sub'>由规则引擎生成（AI 教练版接入后自动升级）</Text>

      {/* 概览 */}
      <View className='card overview'>
        <View className='stat'>
          <Text className='stat-num num'>{(rate * 100).toFixed(0)}%</Text>
          <Text className='stat-label'>完成率</Text>
        </View>
        <View className='stat'>
          <Text className='stat-num num'>{rpe != null ? rpe.toFixed(1) : '—'}</Text>
          <Text className='stat-label'>平均 RPE</Text>
        </View>
        <View className='stat'>
          <Text className='stat-num num'>{sessionCount}</Text>
          <Text className='stat-label'>训练次数</Text>
        </View>
      </View>

      {/* 教练总结 */}
      <View className='card summary-card'>
        <Text className='sec-label'>教练总结</Text>
        <Text className='summary-text'>{summaryText}</Text>
      </View>

      {/* 下周期调整清单 */}
      <View className='card adj-card'>
        <Text className='sec-label'>下周期调整（逐项确认，可手改重量）</Text>
        {adjustments.length === 0 && (
          <Text className='adj-empty'>暂无可调整的动作（先去训练）</Text>
        )}
        {adjustments.map(adj => {
          const name = getExercise(adj.exerciseId)?.name ?? adj.exerciseId
          const on = accepted.has(adj.exerciseId)
          const tag =
            adj.action === 'increase' ? '加重' : adj.action === 'reduce' ? '减载' : adj.action === 'replace' ? '换动作' : '保持'
          return (
            <View key={adj.exerciseId} className={`adj-row ${on ? '' : 'off'}`}>
              <View className='adj-head' onClick={() => toggleAccept(adj.exerciseId)}>
                <Text className='adj-check'>{on ? '✓' : '○'}</Text>
                <Text className='adj-name'>{name}</Text>
                <Text className={`adj-tag tag-${adj.action}`}>{tag}</Text>
              </View>
              <Text className='adj-detail num'>
                {adj.currentWeightKg ?? 0}kg
                {adj.nextWeightKg != null && adj.nextWeightKg !== adj.currentWeightKg
                  ? ` → ${adj.nextWeightKg}kg`
                  : ''}
              </Text>
              {adj.nextWeightKg != null && adj.action !== 'hold' && (
                <View className='adj-stepper'>
                  <Text className='adj-step' onClick={() => bumpWeight(adj, -2.5)}>−2.5</Text>
                  <Text className='adj-step' onClick={() => bumpWeight(adj, 2.5)}>+2.5</Text>
                </View>
              )}
              <Text className='adj-reason'>{adj.reason}</Text>
              {adj.overridden && (
                <Text className='adj-guard'>护栏已修正：{adj.overridden.rule}</Text>
              )}
            </View>
          )
        })}
      </View>

      {/* 警示 */}
      {warnings.map((w, i) => (
        <Text key={i} className='warning-line'>{w}</Text>
      ))}

      {/* 确认 */}
      {!confirmed ? (
        <View className='btn-primary confirm-btn' onClick={() => void confirm()}>
          <Text className='confirm-text'>确认下周期（{accepted.size}/{adjustments.length} 项）</Text>
        </View>
      ) : (
        <Text className='confirmed-hint'>已确认，新周期已加入计划，按「训练」页继续即可</Text>
      )}
    </View>
  )
}
