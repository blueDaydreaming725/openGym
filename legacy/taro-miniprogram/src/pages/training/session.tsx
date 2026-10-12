import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import './session.scss'
import { getSession, saveSession } from '../../services/storage'
import { allExercises, findAlternatives, getExercise } from '../../core/exercise-library'
import { isCycleDue } from '../../core/cycle'
import type { SessionCursor, SessionExerciseItem, SessionRecord } from '../../types/models'

const RPE_OPTIONS = [6, 7, 8, 9, 10]

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 训练进行页：聚焦单动作 + 组间倒计时 + RPE + 中途换动作；现场实时写盘，来电/杀进程可精确恢复 */
export default function Session() {
  const router = useRouter()
  const sessionId = router.params.sessionId ?? ''

  const [session, setSession] = useState<SessionRecord>()
  const [curIdx, setCurIdx] = useState(0)
  const [curWeight, setCurWeight] = useState(0)
  const [curReps, setCurReps] = useState('8')
  const [curRpe, setCurRpe] = useState<number>()
  const [restLeft, setRestLeft] = useState(0)
  const [restTotal, setRestTotal] = useState(0)
  const [restDeadline, setRestDeadline] = useState<number>()
  const [now, setNow] = useState(Date.now())
  const [cuesOpen, setCuesOpen] = useState(true)
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 首次进入：加载会话并恢复现场（cursor 里有上次中断时的动作/重量/倒计时）
  useEffect(() => {
    void (async () => {
      const s = await getSession(sessionId)
      if (!s) {
        Taro.showToast({ title: '会话不存在', icon: 'error' })
        Taro.navigateBack()
        return
      }
      setSession(s)
      const c = s.cursor
      const firstIdx = s.exercises.findIndex(e => !e.skipped)
      const idx = Math.max(0, Math.min(s.exercises.length - 1, c?.curIdx ?? firstIdx))
      setCurIdx(idx)
      setCurWeight(c?.curWeightKg ?? s.exercises[idx]?.targetWeightKg ?? 0)
      setCurReps(c?.curReps ?? String(s.exercises[idx]?.targetRepMin ?? 8))
      if (c?.curRpe != null) setCurRpe(c.curRpe)
      // 恢复未走完的组间倒计时（按绝对截止时间换算剩余秒数）
      if (c?.restDeadline && c.restDeadline > Date.now()) {
        setRestTotal(c.restTotal ?? 90)
        setRestLeft(Math.ceil((c.restDeadline - Date.now()) / 1000))
        setRestDeadline(c.restDeadline)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // 会话总时长计时（每秒）
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // 组间倒计时：按绝对截止时间驱动，恢复时无需重算
  useEffect(() => {
    if (!restDeadline) return
    restTimerRef.current = setInterval(() => {
      const left = Math.ceil((restDeadline - Date.now()) / 1000)
      if (left <= 0) {
        if (restTimerRef.current) clearInterval(restTimerRef.current)
        setRestDeadline(undefined)
        setRestLeft(0)
        Taro.vibrateShort({ type: 'medium' })
      } else {
        setRestLeft(left)
      }
    }, 500)
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current)
    }
  }, [restDeadline])

  const cur: SessionExerciseItem | undefined = session?.exercises[curIdx]
  const curEx = cur ? getExercise(cur.exerciseId) : undefined
  const stepKg = curEx?.stepKg ?? 2.5

  /** 持久化会话 + 训练现场（每次状态变化都写盘，杀进程可恢复）；返回保存后的全部记录 */
  const persist = async (next: SessionRecord, curOverride?: Partial<SessionCursor>): Promise<SessionRecord[]> => {
    const cursor: SessionCursor = {
      curIdx: curOverride?.curIdx ?? curIdx,
      curWeightKg: curOverride?.curWeightKg ?? curWeight,
      curReps: curOverride?.curReps ?? curReps,
      curRpe: curOverride?.curRpe ?? curRpe,
      restDeadline: curOverride?.restDeadline ?? restDeadline,
      restTotal: curOverride?.restTotal ?? restTotal,
    }
    const merged: SessionRecord = { ...next, cursor }
    setSession(merged)
    await saveSession(merged)
    const { listSessionRecords } = await import('../../services/storage')
    return listSessionRecords(session?.cycleId ?? next.cycleId)
  }

  /** 完成本组 */
  const completeSet = () => {
    if (!session || !cur) return
    const reps = Number(curReps)
    if (!reps || reps <= 0) {
      Taro.showToast({ title: '请填写次数', icon: 'error' })
      return
    }
    const item = session.exercises[curIdx]
    const sets = [
      ...item.sets,
      { setNo: item.sets.length + 1, weightKg: curWeight, reps, rpe: curRpe },
    ]
    const rest = item.restSeconds ?? 90
    const deadline = rest > 0 ? Date.now() + rest * 1000 : undefined
    void (async () => {
      const next: SessionRecord = {
        ...session,
        exercises: session.exercises.map((it, i) => (i === curIdx ? { ...it, sets } : it)),
      }
      await persist(next, { restDeadline: deadline, restTotal: rest > 0 ? rest : 0 })
      if (rest > 0) {
        setRestTotal(rest)
        setRestDeadline(deadline)
        setRestLeft(rest)
      }
    })()
  }

  const goto = (idx: number) => {
    if (!session) return
    const clamped = Math.max(0, Math.min(session.exercises.length - 1, idx))
    const target = session.exercises[clamped]
    const w = target?.targetWeightKg ?? target?.sets.at(-1)?.weightKg ?? 0
    const r = String(target?.targetRepMin ?? 8)
    setCurIdx(clamped)
    setCurWeight(w)
    setCurReps(r)
    setCurRpe(undefined)
    setCuesOpen(true)
    void persist(session, { curIdx: clamped, curWeightKg: w, curReps: r })
  }

  /** 重量步进（每次点击即写盘） */
  const stepWeight = (delta: number) => {
    if (!session) return
    const next = Math.max(0, curWeight + delta)
    setCurWeight(next)
    void persist(session, { curWeightKg: next })
  }

  /** RPE 选择（写盘） */
  const selectRpe = (r: number) => {
    if (!session) return
    const next = curRpe === r ? undefined : r
    setCurRpe(next)
    void persist(session, { curRpe: next })
  }

  /** 次数输入失焦（写盘） */
  const onRepsBlur = () => {
    if (!session) return
    void persist(session, { curReps })
  }

  /** 换动作（同肌群候选，记录 replacedFromExerciseId） */
  const replaceExercise = (newId: string) => {
    if (!session || !cur) return
    const ex = getExercise(newId)
    void persist(
      {
        ...session,
        exercises: session.exercises.map((it, i) =>
          i === curIdx
            ? {
                ...it,
                exerciseId: newId,
                replacedFromExerciseId: it.replacedFromExerciseId ?? it.exerciseId,
                restSeconds: ex?.defaultRestSeconds ?? it.restSeconds,
              }
            : it,
        ),
      },
      { curWeightKg: 0 },
    )
  }

  const addExercise = (newId: string) => {
    if (!session) return
    const ex = getExercise(newId)
    const item: SessionExerciseItem = {
      exerciseId: newId,
      plannedSets: 3,
      targetRepMin: 10,
      targetRepMax: 12,
      targetWeightKg: undefined,
      restSeconds: ex?.defaultRestSeconds ?? 90,
      sets: [],
    }
    void persist({ ...session, exercises: [...session.exercises, item] })
  }

  const skipExercise = () => {
    if (!session || !cur) return
    void (async () => {
      const next: SessionRecord = {
        ...session,
        exercises: session.exercises.map((it, i) => (i === curIdx ? { ...it, skipped: true } : it)),
      }
      await persist(next)
      goto(curIdx + 1)
    })()
  }

  /** 结束训练 */
  const finish = () => {
    if (!session) return
    Taro.showModal({
      title: '结束训练',
      content: '将汇总本次记录并保存',
      confirmText: '结束',
      cancelText: '再练会',
      success: res => {
        if (!res.confirm || !session) return
        const endedAt = new Date().toISOString()
        const seconds = Math.max(60, Math.round((now - new Date(session.startedAt ?? endedAt).getTime()) / 1000))
        void (async () => {
          const done = await persist({ ...session, status: 'completed', endedAt, durationMinutes: Math.round(seconds / 60) })
          // 结束训练后自动判断周期是否到期（日期制/次数制），到期则引导复盘
          const cycleDone = done
          const plan = await (async () => {
            const { listPlans } = await import('../../services/storage')
            const plans = await listPlans()
            return plans.find(p => p.id === session.planId)
          })()
          const cycle = plan?.cycles.find(c => c.id === session.cycleId)
          if (cycle && isCycleDue(cycle, cycleDone.filter(r => r.cycleId === cycle.id).length)) {
            Taro.showModal({
              title: '本周期已到期',
              content: `「${cycle.name}」已完成，去看看总结并定下一周期`,
              confirmText: '去复盘',
              cancelText: '稍后',
              success: r => {
                if (r.confirm) {
                  Taro.navigateTo({ url: `/pages/review/review?planId=${session.planId}&cycleId=${cycle.id}` })
                } else {
                  Taro.switchTab({ url: '/pages/training/plan' })
                }
              },
            })
          } else {
            Taro.switchTab({ url: '/pages/training/plan' })
          }
        })()
      },
    })
  }

  const lib = allExercises()
  const alts = useMemo(() => (cur ? findAlternatives(cur.exerciseId) : []), [cur])
  const elapsedSec = session?.startedAt
    ? Math.max(0, Math.round((now - new Date(session.startedAt).getTime()) / 1000))
    : 0
  const doneSets = cur?.sets.length ?? 0
  const setGoalMet = cur ? doneSets >= cur.plannedSets : false

  // 下一动作预览（一屏两动作：做 A 看得到 B）
  const nextItem = useMemo(() => {
    if (!session) return null
    const found = session.exercises
      .map((it, i) => ({ it, i }))
      .find(({ it, i }) => i !== curIdx && !it.skipped && i > curIdx)
    if (!found) return null
    return { ...found, ex: getExercise(found.it.exerciseId) }
  }, [session, curIdx])

  if (!session || !cur) {
    return (
      <View className='session-page'>
        <Text className='loading-hint'>加载中…</Text>
      </View>
    )
  }

  return (
    <View className='session-page'>
      {/* 顶部：会话计时 + 进度 */}
      <View className='top-bar'>
        <Text className='elapsed num'>{fmtDuration(elapsedSec)}</Text>
        <Text className='progress num'>
          动作 {curIdx + 1}/{session.exercises.length} · 第 {doneSets}/{cur.plannedSets} 组
        </Text>
      </View>

      {/* 组间倒计时条 */}
      {restLeft > 0 && (
        <View className='rest-bar'>
          <View
            className='rest-fill'
            style={{ width: `${restTotal > 0 ? (restLeft / restTotal) * 100 : 0}%` }}
          />
          <Text className='rest-label'>休息</Text>
          <Text className='rest-time num'>{fmtDuration(restLeft)}</Text>
          <Text
            className='rest-btn'
            onClick={() => {
              setRestDeadline(d => (d ? d + 15000 : undefined))
              setRestLeft(v => v + 15)
            }}
          >
            +15s
          </Text>
          <Text
            className='rest-btn'
            onClick={() => {
              if (!session) return
              setRestDeadline(undefined)
              setRestLeft(0)
              void persist(session, { restDeadline: undefined })
            }}
          >
            跳过
          </Text>
        </View>
      )}

      {/* 聚焦单动作卡片 */}
      <View className='focus-card'>
        <View className='focus-head'>
          <Text className='ex-name'>{curEx?.name ?? cur.exerciseId}</Text>
          <Text
            className='cues-toggle'
            onClick={() => setCuesOpen(v => !v)}
          >
            {cuesOpen ? '收起要点' : '看要点'}
          </Text>
        </View>

        {cuesOpen && curEx?.cues && (
          <View className='cues-block'>
            {curEx.cues.map((c, i) => (
              <Text key={i} className='cue-line'>· {c}</Text>
            ))}
          </View>
        )}

        {/* 已完成组 */}
        {cur.sets.length > 0 && (
          <View className='sets-list'>
            {cur.sets.map(s => (
              <View key={s.setNo} className='set-row'>
                <Text className='set-no num'>{s.setNo}</Text>
                <Text className='set-detail num'>{s.weightKg}kg × {s.reps}</Text>
                <Text className='set-rpe num'>{s.rpe != null ? `RPE ${s.rpe}` : '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 当前组输入 */}
        <View className='input-block'>
          <View className='weight-stepper'>
            <Text className='wbtn' onClick={() => stepWeight(-stepKg)}>
              −{stepKg}
            </Text>
            <Text className='weight num'>{curWeight}<Text className='unit'>kg</Text></Text>
            <Text className='wbtn' onClick={() => stepWeight(stepKg)}>
              +{stepKg}
            </Text>
          </View>
          <View className='reps-row'>
            <Text className='reps-label'>次数</Text>
            <Input
              className='reps-input num'
              type='number'
              value={curReps}
              onInput={e => setCurReps(e.detail.value)}
              onBlur={onRepsBlur}
            />
          </View>
          <View className='rpe-row'>
            <Text className='rpe-label'>RPE</Text>
            {RPE_OPTIONS.map(r => (
              <Text
                key={r}
                className={`rpe-btn num ${curRpe === r ? 'active' : ''}`}
                onClick={() => selectRpe(r)}
              >
                {r}
              </Text>
            ))}
          </View>
        </View>

        <View className='btn-primary complete-btn' onClick={completeSet}>
          <Text className='complete-text'>完成本组</Text>
        </View>

        {setGoalMet && (
          <Text className='goal-hint'>目标组数已完成，可继续加做或切下一个动作</Text>
        )}

        {/* 下一动作预览（一屏两动作：做 A 看得到 B） */}
        {nextItem && (
          <View className='next-card' onClick={() => goto(nextItem.i)}>
            <Text className='next-label'>接下来</Text>
            <View className='next-row'>
              <Text className='next-name'>{nextItem.ex?.name ?? nextItem.it.exerciseId}</Text>
              <Text className='next-plan num'>
                {nextItem.it.plannedSets} 组 ×{' '}
                {nextItem.it.targetRepMin ?? nextItem.it.sets.at(-1)?.reps ?? '-'}
                {nextItem.it.targetWeightKg ? ` @ ${nextItem.it.targetWeightKg}kg` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* 动作级操作 */}
        <View className='ex-ops'>
          <Text className='op' onClick={() => goto(curIdx - 1)}>上一个</Text>
          <Picker
            mode='selector'
            range={alts.map(a => `${a.name}（${a.equipment ?? ''}）`)}
            onChange={e => replaceExercise(alts[Number(e.detail.value)].id)}
          >
            <Text className='op'>换动作</Text>
          </Picker>
          <Text className='op' onClick={skipExercise}>跳过</Text>
          <Text className='op' onClick={() => goto(curIdx + 1)}>下一个</Text>
        </View>
      </View>

      {/* 添加动作 + 结束 */}
      <Picker
        mode='selector'
        range={lib.map(e => `${e.name} · ${e.muscleGroup}`)}
        onChange={e => addExercise(lib[Number(e.detail.value)].id)}
      >
        <View className='add-row'>
          <Text className='add-text'>加一个动作</Text>
        </View>
      </Picker>

      <View className='finish-bar'>
        <View className='btn-secondary' onClick={finish}>
          <Text className='finish-text'>结束训练</Text>
        </View>
      </View>
    </View>
  )
}
