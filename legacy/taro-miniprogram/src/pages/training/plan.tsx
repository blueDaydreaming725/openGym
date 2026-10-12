import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import './plan.scss'
import {
  listPlans,
  savePlan,
  saveSession,
  saveKnowledge,
  getActiveSession,
  listSessionRecords,
} from '../../services/storage'
import { buildBenchPlan, buildFatlossPlan, buildSplitPlan } from '../../core/plan-templates'
import { getActiveCycle } from '../../core/cycle'
import {
  buildClawPlan,
  buildClawHistory,
  buildClawKnowledge,
  CLAW_PLAN_NAME,
} from '../../core/claw-plan'
import type { SessionRecord, TrainingPlan } from '../../types/models'

/** 训练 hub：当前计划 + 今日训练 + 模板创建 + 进行中会话恢复 */
export default function Plan() {
  const [plans, setPlans] = useState<TrainingPlan[]>([])
  const [active, setActive] = useState<SessionRecord>()
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState<{
    plan: TrainingPlan
    workoutId: string
    workoutName: string
  }>()

  useDidShow(() => {
    void (async () => {
      setLoading(true)
      const ps = await listPlans()
      setPlans(ps)
      setActive(await getActiveSession())
      // 今日训练：最新计划，按本周期已完成会话数在模板间轮转
      if (ps.length > 0) {
        const plan = ps[ps.length - 1]
        const cycle = plan.cycles[plan.cycles.length - 1]
        const records = await listSessionRecords(cycle.id)
        const idx = cycle.workouts.length > 0 ? records.length % cycle.workouts.length : 0
        const wo = cycle.workouts[idx]
        if (wo) setToday({ plan, workoutId: wo.id, workoutName: wo.name })
      }
      setLoading(false)
    })()
  })

  const createTemplate = async (fn: () => TrainingPlan) => {
    const plan = fn()
    plan.cycles = plan.cycles.map(c => ({ ...c, planId: plan.id }))
    await savePlan(plan)
    setPlans(await listPlans())
    Taro.showToast({ title: '计划已创建', icon: 'success' })
  }

  /** 一键导入 Claw 计划；已导入过则就地升级（补周期截止日与旅行维持期，记录引用不受影响） */
  const importClaw = async () => {
    const existing = await listPlans()
    const idx = existing.findIndex(p => p.name === CLAW_PLAN_NAME)
    const plan = buildClawPlan()
    plan.cycles = plan.cycles.map(c => ({ ...c, planId: plan.id }))

    if (idx >= 0) {
      const old = existing[idx]
      old.note = plan.note
      if (old.cycles[0]) {
        old.cycles[0].name = '减脂塑形专项（至 9/24）'
        old.cycles[0].endDate = '2026-09-24'
      }
      if (!old.cycles.some(c => c.name.includes('旅行'))) {
        old.cycles.push(plan.cycles[1])
      }
      await savePlan(old)
      setPlans(await listPlans())
      Taro.showToast({ title: '计划已升级：周期改为日期制并预置旅行期', icon: 'success' })
      return
    }

    await savePlan(plan)
    for (const rec of buildClawHistory(plan.id, plan.cycles[0].id)) {
      await saveSession(rec)
    }
    for (const kb of buildClawKnowledge()) {
      await saveKnowledge(kb)
    }
    setPlans(await listPlans())
    Taro.showToast({ title: '导入完成：计划 + 3 次历史 + 4 条知识', icon: 'success' })
  }

  const startPrep = (plan: TrainingPlan, workoutId: string) => {
    const cycle = getActiveCycle(plan.cycles)
    Taro.navigateTo({
      url: `/pages/training/prep?planId=${plan.id}&cycleId=${cycle.id}&workoutId=${workoutId}`,
    })
  }

  const resumeSession = () => {
    if (active) Taro.navigateTo({ url: `/pages/training/session?sessionId=${active.id}` })
  }

  return (
    <View className='plan-page'>
      {loading && <Text className='loading-hint'>加载中…</Text>}

      {!loading && active && (
        <View className='resume-banner' onClick={resumeSession}>
          <Text className='resume-title'>有一次进行中的训练</Text>
          <Text className='resume-action'>继续训练</Text>
        </View>
      )}

      {!loading && today && !active && (
        <View className='card card-hero today-card' onClick={() => startPrep(today.plan, today.workoutId)}>
          <Text className='today-label'>今日训练</Text>
          <Text className='today-name'>{today.workoutName}</Text>
          <Text className='today-cta'>准备并开始</Text>
        </View>
      )}

      {!loading && plans.length === 0 && (
        <View className='empty-block'>
          <Text className='empty-title'>还没有训练计划</Text>
          <Text className='empty-sub'>从模板开始，之后每次训练前都能换动作</Text>
        </View>
      )}

      {!loading && plans.map(plan => {
        const active = getActiveCycle(plan.cycles)
        return (
          <View key={plan.id} className='card plan-card'>
            <Text className='plan-name'>{plan.name}</Text>
            <Text className='plan-meta'>
              每周期 {plan.trainDaysPerCycle} 练 · 当前：{active.name}
            </Text>
            {active.workouts.map(wo => (
              <Text
                key={wo.id}
                className='plan-workout-row'
                onClick={() => startPrep(plan, wo.id)}
              >
                {wo.name} · 准备训练
              </Text>
            ))}
          </View>
        )
      })}

      <View className='template-block'>
        <Text className='block-title'>从模板创建计划</Text>
        <Text className='tpl-row claw' onClick={() => void importClaw()}>导入 Claw 的形体期 PPL（含历史与规则）</Text>
        <Text className='tpl-row' onClick={() => void createTemplate(() => buildSplitPlan({ splitKind: 3, name: '三分化 · 推拉腿' }))}>三分化 · 推拉腿（3 练 1 休）</Text>
        <Text className='tpl-row' onClick={() => void createTemplate(() => buildSplitPlan({ splitKind: 2, name: '二分化 · 上下肢' }))}>二分化 · 上下肢（2 练 1 休）</Text>
        <Text className='tpl-row' onClick={() => void createTemplate(() => buildSplitPlan({ splitKind: 4, name: '四分化' }))}>四分化（胸背腿肩臂）</Text>
        <Text className='tpl-row' onClick={() => void createTemplate(() => buildSplitPlan({ splitKind: 5, name: '五分化' }))}>五分化（5 练 1 休）</Text>
        <Text className='tpl-row' onClick={() => void createTemplate(() => buildBenchPlan({ bench1rmKg: 60 }))}>卧推 5/3/1（默认 1RM 60kg）</Text>
        <Text className='tpl-row' onClick={() => void createTemplate(() => buildFatlossPlan())}>减脂计划（3 力量 + 3 有氧）</Text>
      </View>
    </View>
  )
}
