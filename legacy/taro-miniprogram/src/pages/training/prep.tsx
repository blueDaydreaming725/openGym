import { useEffect, useState } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import './prep.scss'
import {
  getWorkouts,
  startSession,
  saveSession,
} from '../../services/storage'
import { allExercises, findAlternatives, getExercise } from '../../core/exercise-library'
import type { SessionExerciseItem } from '../../types/models'

/** 训练准备页：今日推荐动作清单，可增删替换（默认已按模板推荐好），点「开始训练」进入进行页 */
export default function Prep() {
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const cycleId = router.params.cycleId ?? ''
  const workoutId = router.params.workoutId ?? ''

  const [items, setItems] = useState<SessionExerciseItem[]>([])
  const [workoutName, setWorkoutName] = useState('')
  const [allWorkouts, setAllWorkouts] = useState<Array<{ id: string; name: string }>>([])
  const [noteText, setNoteText] = useState('')
  const [loaded, setLoaded] = useState(false)

  // 首次进入：由模板生成动作实例清单（默认推荐）
  useEffect(() => {
    void (async () => {
      if (loaded) return
      const workouts = await getWorkouts(cycleId)
      setAllWorkouts(workouts.map(w => ({ id: w.id, name: w.name })))
      const wo = workouts.find(w => w.id === workoutId)
      if (!wo) {
        Taro.showToast({ title: '未找到该训练模板', icon: 'error' })
        return
      }
      setWorkoutName(wo.name)
      setItems(
        wo.items.map(it => ({
          exerciseId: it.exerciseId,
          plannedSets: it.sets,
          targetRepMin: it.repRangeMin,
          targetRepMax: it.repRangeMax,
          targetWeightKg: it.targetWeightKg,
          restSeconds: it.restSeconds ?? 90,
          sets: [],
        })),
      )
      setLoaded(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, cycleId, workoutId])

  const patch = (idx: number, p: Partial<SessionExerciseItem>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...p } : it)))
  }

  const remove = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  /** 换动作：同肌群候选（器械被占场景） */
  const replace = (idx: number, newId: string) => {
    const original = items[idx].exerciseId
    if (newId === original) return
    const ex = getExercise(newId)
    patch(idx, {
      exerciseId: newId,
      replacedFromExerciseId: items[idx].replacedFromExerciseId ?? original,
      restSeconds: ex?.defaultRestSeconds ?? items[idx].restSeconds,
    })
  }

  /** 整组换课：腿伤/朋友一起/器械全被占——直接换一天练 */
  const swapWorkout = (newId: string) => {
    if (newId === workoutId) return
    void (async () => {
      const workouts = await getWorkouts(cycleId)
      const wo = workouts.find(w => w.id === newId)
      if (!wo) return
      setWorkoutName(wo.name)
      setItems(
        wo.items.map(it => ({
          exerciseId: it.exerciseId,
          plannedSets: it.sets,
          targetRepMin: it.repRangeMin,
          targetRepMax: it.repRangeMax,
          targetWeightKg: it.targetWeightKg,
          restSeconds: it.restSeconds ?? 90,
          sets: [],
        })),
      )
      Taro.showToast({ title: `已换成：${wo.name}`, icon: 'none' })
    })()
  }

  /** 从动作库添加动作 */
  const add = (newId: string) => {
    const ex = getExercise(newId)
    if (!ex) return
    setItems(prev => [
      ...prev,
      {
        exerciseId: newId,
        plannedSets: 3,
        targetRepMin: 10,
        targetRepMax: 12,
        targetWeightKg: undefined,
        restSeconds: ex.defaultRestSeconds ?? 90,
        sets: [],
      },
    ])
  }

  const start = async () => {
    if (items.length === 0) {
      Taro.showToast({ title: '至少保留一个动作', icon: 'error' })
      return
    }
    const created = await startSession(planId, cycleId, {
      id: workoutId,
      name: workoutName,
      items: [],
    })
    // 用准备页调整后的清单覆盖模板生成的清单；备注随记录保存
    created.exercises = items
    if (noteText.trim()) created.note = noteText.trim()
    await saveSession(created)
    Taro.redirectTo({ url: `/pages/training/session?sessionId=${created.id}` })
  }

  const lib = allExercises()

  return (
    <View className='prep-page'>
      <Text className='page-title'>{workoutName || '训练准备'}</Text>
      <Text className='page-sub'>默认已按模板推荐，可调整后再开始</Text>

      {allWorkouts.length > 1 && (
        <Picker
          mode='selector'
          range={allWorkouts.map(w => (w.id === workoutId ? `${w.name}（当前）` : w.name))}
          onChange={e => swapWorkout(allWorkouts[Number(e.detail.value)].id)}
        >
          <View className='swap-day-row'>
            <Text className='swap-day-text'>换一天练（受伤 / 朋友一起 / 想换着练）</Text>
          </View>
        </Picker>
      )}

      {items.map((it, idx) => {
        const ex = getExercise(it.exerciseId)
        const alts = findAlternatives(it.exerciseId)
        return (
          <View key={`${it.exerciseId}_${idx}`} className='card prep-item'>
            <View className='item-head'>
              <Text className='item-name'>{ex?.name ?? it.exerciseId}</Text>
              <Text className='item-remove' onClick={() => remove(idx)}>移除</Text>
            </View>
            {it.replacedFromExerciseId && (
              <Text className='item-replaced'>
                由 {getExercise(it.replacedFromExerciseId)?.name ?? '原动作'} 替换而来
              </Text>
            )}
            {ex?.cues && ex.cues.length > 0 && (
              <View className='item-cues'>
                {ex.cues.map((c, ci) => (
                  <Text key={ci} className='cue-line'>· {c}</Text>
                ))}
              </View>
            )}
            <View className='item-ctrl'>
              <View className='stepper'>
                <Text
                  className='step-btn'
                  onClick={() => patch(idx, { plannedSets: Math.max(1, it.plannedSets - 1) })}
                >
                  −
                </Text>
                <Text className='step-value num'>{it.plannedSets} 组</Text>
                <Text
                  className='step-btn'
                  onClick={() => patch(idx, { plannedSets: Math.min(10, it.plannedSets + 1) })}
                >
                  +
                </Text>
              </View>
              {(it.targetWeightKg ?? 0) > 0 && (
                <View className='stepper'>
                  <Text
                    className='step-btn'
                    onClick={() =>
                      patch(idx, {
                        targetWeightKg: Math.max(
                          0,
                          (it.targetWeightKg ?? 0) - (ex?.stepKg ?? 2.5),
                        ),
                      })
                    }
                  >
                    −
                  </Text>
                  <Text className='step-value num'>{it.targetWeightKg}kg</Text>
                  <Text
                    className='step-btn'
                    onClick={() =>
                      patch(idx, {
                        targetWeightKg: (it.targetWeightKg ?? 0) + (ex?.stepKg ?? 2.5),
                      })
                    }
                  >
                    +
                  </Text>
                </View>
              )}
            </View>
            {alts.length > 0 && (
              <Picker
                mode='selector'
                range={alts.map(a => `${a.name}（${a.equipment ?? ''}）`)}
                onChange={e => replace(idx, alts[Number(e.detail.value)].id)}
              >
                <Text className='item-swap'>换动作（同肌群，器械被占时用）</Text>
              </Picker>
            )}
          </View>
        )
      })}

      <Picker
        mode='selector'
        range={lib.map(e => `${e.name} · ${e.muscleGroup}`)}
        onChange={e => add(lib[Number(e.detail.value)].id)}
      >
        <View className='add-row'>
          <Text className='add-text'>从动作库添加动作</Text>
        </View>
      </Picker>

      <View className='note-row'>
        <Input
          className='note-input'
          value={noteText}
          placeholder='备注：腿伤改练推 / 朋友一起练…（写入记录）'
          onInput={e => setNoteText(e.detail.value)}
        />
      </View>

      <View className='start-bar'>
        <View className='btn-primary' onClick={() => void start()}>
          <Text className='btn-primary-text'>开始训练（{items.length} 个动作）</Text>
        </View>
      </View>
    </View>
  )
}
