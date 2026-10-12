import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import './index.scss'
import {
  listPlans,
  listAllSessionRecords,
  listSessionRecords,
  getActiveSession,
  listDietRecords,
  listSupplementPlans,
} from '../../services/storage'
import { getExercise } from '../../core/exercise-library'
import { getActiveCycle, endLabel } from '../../core/cycle'
import type { SessionRecord, TrainingPlan } from '../../types/models'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const MUSCLE_LABEL: Record<string, string> = {
  胸: '推', 肩: '推', 手臂: '推', 背: '拉', 腿: '腿', 核心: '核', 有氧: '有',
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const SUPP_CHECK_KEY = 'fa:supp-checks'

async function getSuppChecks(date: string): Promise<string[]> {
  try {
    const res = await Taro.getStorage({ key: SUPP_CHECK_KEY })
    const map = (res.data as Record<string, string[]>) ?? {}
    return map[date] ?? []
  } catch {
    return []
  }
}

async function toggleSuppCheck(date: string, name: string): Promise<string[]> {
  let map: Record<string, string[]> = {}
  try {
    const res = await Taro.getStorage({ key: SUPP_CHECK_KEY })
    map = (res.data as Record<string, string[]>) ?? {}
  } catch { /* 首次无数据 */ }
  const list = new Set(map[date] ?? [])
  if (list.has(name)) list.delete(name)
  else list.add(name)
  map[date] = Array.from(list)
  await Taro.setStorage({ key: SUPP_CHECK_KEY, data: map })
  return map[date]
}

/** 首页仪表盘：今日训练 / 周期进度 / 今日热量 / 补剂打卡 */
export default function Index() {
  const [active, setActive] = useState<SessionRecord>()
  const [today, setToday] = useState<{ plan: TrainingPlan; workoutName: string }>()
  const [cycleDone, setCycleDone] = useState(0)
  const [cycleTotal, setCycleTotal] = useState(0)
  const [cycleEnd, setCycleEnd] = useState<string | null>(null)
  const [cycleName, setCycleName] = useState('')
  const [calories, setCalories] = useState(0)
  const [suppItems, setSuppItems] = useState<string[]>([])
  const [suppDone, setSuppDone] = useState<string[]>([])
  const [calDays, setCalDays] = useState<Array<{ date: string; weekday: string; day: number; label: string; done: boolean; today: boolean }>>([])

  useDidShow(() => {
    void (async () => {
      const date = todayStr()
      setActive(await getActiveSession())

      const plans = await listPlans()
      if (plans.length > 0) {
        const plan = plans[plans.length - 1]
        const cycle = getActiveCycle(plan.cycles)
        const records = await listSessionRecords(cycle.id)
        setCycleDone(records.length)
        setCycleTotal(cycle.workouts.length)
        setCycleEnd(endLabel(cycle.endDate))
        setCycleName(cycle.name)
        const idx = cycle.workouts.length > 0 ? records.length % cycle.workouts.length : 0
        const wo = cycle.workouts[idx]
        if (wo) setToday({ plan, workoutName: wo.name })
        else setToday(undefined)
      } else {
        setToday(undefined)
      }

      // 双周日历：最近 14 天（7 列 × 2 行）
      const all = await listAllSessionRecords()
      const byDate = new Map<string, SessionRecord[]>()
      for (const r of all) {
        byDate.set(r.date, [...(byDate.get(r.date) ?? []), r])
      }
      const days: Array<{ date: string; weekday: string; day: number; label: string; done: boolean; today: boolean }> = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const ds = d.toISOString().slice(0, 10)
        const recs = byDate.get(ds)
        let label = '休'
        if (recs && recs.length > 0) {
          const r = recs[0]
          label = r.workoutName
            ? MUSCLE_LABEL[r.workoutName.slice(0, 1)] ?? r.workoutName.slice(0, 1)
            : MUSCLE_LABEL[getExercise(r.exercises[0]?.exerciseId ?? '')?.muscleGroup ?? ''] ?? '练'
        } else if (i === 13 || plans.length === 0) {
          label = '·' // 计划开始前不标休
        }
        days.push({
          date: ds,
          weekday: WEEKDAYS[d.getDay()],
          day: d.getDate(),
          label,
          done: !!recs?.length,
          today: ds === date,
        })
      }
      setCalDays(days)

      const diets = await listDietRecords(date)
      setCalories(diets.reduce((s, d) => s + d.totalCalories, 0))

      const plans2 = await listSupplementPlans()
      const items = plans2[plans2.length - 1]?.items.map(i => `${i.name} · ${i.dosage}`) ?? []
      setSuppItems(items)
      setSuppDone(await getSuppChecks(date))
    })()
  })

  const goPrep = () => {
    if (!today) return
    const cycle = today.plan.cycles[today.plan.cycles.length - 1]
    const wo = cycle.workouts[cycleDone % cycle.workouts.length]
    Taro.navigateTo({
      url: `/pages/training/prep?planId=${today.plan.id}&cycleId=${cycle.id}&workoutId=${wo.id}`,
    })
  }

  const goResume = () => {
    if (active) Taro.navigateTo({ url: `/pages/training/session?sessionId=${active.id}` })
  }

  const goReview = () => {
    if (!today) return
    const cycle = getActiveCycle(today.plan.cycles)
    Taro.navigateTo({ url: `/pages/review/review?planId=${today.plan.id}&cycleId=${cycle.id}` })
  }

  const toggleSupp = (label: string) => {
    void toggleSuppCheck(todayStr(), label).then(setSuppDone)
  }

  const gotoTab = (url: string) => {
    Taro.switchTab({ url })
  }

  return (
    <View className='index-page'>
      {/* 进行中训练 */}
      {active && (
        <View className='resume-banner' onClick={goResume}>
          <Text className='resume-title'>训练进行中</Text>
          <Text className='resume-action'>继续</Text>
        </View>
      )}

      {/* 今日训练 */}
        <View className='card card-hero today-card'>
        <Text className='sec-label'>今日训练</Text>
        {today ? (
          <>
            <Text className='today-name'>{today.workoutName}</Text>
            {!active && (
              <View className='btn-primary today-go' onClick={goPrep}>
                <Text className='btn-primary-text'>准备并开始</Text>
              </View>
            )}
          </>
        ) : (
          <Text className='today-empty'>
            还没有计划，去「训练」页从模板创建
          </Text>
        )}
      </View>

      {/* 双周日历 */}
      <View className='card cal-card' onClick={() => Taro.navigateTo({ url: '/pages/history/history' })}>
        <Text className='sec-label'>最近两周</Text>
        <View className='cal-grid'>
          {calDays.map(d => (
            <View
              key={d.date}
              className={`cal-cell ${d.done ? 'done' : ''} ${d.today ? 'today' : ''}`}
            >
              <Text className='cal-week'>{d.weekday}</Text>
              <Text className='cal-day num'>{d.day}</Text>
              <Text className={`cal-label ${d.done ? 'done' : ''}`}>{d.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 当前周期 */}
      {today && (
        <View className='card cycle-card'>
          <View className='cycle-left'>
            <Text className='sec-label'>{cycleName || '当前周期'}</Text>
            <Text className='cycle-line num'>
              已练 {cycleDone} 次 · 轮转 {cycleTotal > 0 ? (cycleDone % cycleTotal) + 1 : 0}/{cycleTotal}
            </Text>
            {cycleEnd && <Text className='cycle-end'>{cycleEnd}</Text>}
            <Text className='cycle-review-link' onClick={goReview}>周期复盘与调整</Text>
          </View>
          <View
            className='ring'
            style={{
              background: `conic-gradient(#6C7BFF ${
                cycleTotal > 0 ? Math.round(((cycleDone % cycleTotal) / cycleTotal) * 100) : 0
              }%, #1C242E 0)`,
            }}
          >
            <View className='ring-inner'>
              <Text className='ring-pct num'>
                {cycleTotal > 0 ? Math.round(((cycleDone % cycleTotal) / cycleTotal) * 100) : 0}%
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 今日热量 */}
      <View className='card diet-card' onClick={() => gotoTab('/pages/diet/diet')}>
        <Text className='sec-label'>今日热量</Text>
        <View className='diet-row'>
          <Text className='diet-num num'>{calories}</Text>
          <Text className='diet-unit'>kcal</Text>
          {calories === 0 && <Text className='diet-hint'>拍照记第一餐</Text>}
        </View>
      </View>

      {/* 补剂打卡 */}
      <View className='card supp-card'>
        <Text className='sec-label'>今日补剂</Text>
        {suppItems.length === 0 ? (
          <Text className='supp-empty' onClick={() => gotoTab('/pages/supplement/supplement')}>
            还没有补剂计划，去「补给」页添加
          </Text>
        ) : (
          suppItems.map(label => {
            const done = suppDone.includes(label)
            return (
              <Text
                key={label}
                className={`supp-item ${done ? 'done' : ''}`}
                onClick={() => toggleSupp(label)}
              >
                {done ? '✓' : '○'} {label}
              </Text>
            )
          })
        )}
      </View>

      {/* 知识库入口 */}
      <View className='kb-row' onClick={() => Taro.navigateTo({ url: '/pages/knowledge/knowledge' })}>
        <Text className='kb-text'>知识库 · 上传资料让 AI 优化计划</Text>
        <Text className='kb-arrow'>›</Text>
      </View>
    </View>
  )
}
