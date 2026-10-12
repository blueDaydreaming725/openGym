import { useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import './history.scss'
import { listAllSessionRecords } from '../../services/storage'
import { exerciseName, sessionTag, setSummary, type SessionTag } from '../../core/session-utils'
import type { SessionRecord } from '../../types/models'

const FILTERS: Array<'全部' | SessionTag> = ['全部', '推', '拉', '腿', '有', '其他']

function fmtDate(iso: string): string {
  return iso.slice(5).replace('-', '/')
}

/** 训练历史：按日期回看每次训练；筛选后可看同类型动作的重量演进 */
export default function History() {
  const [records, setRecords] = useState<SessionRecord[]>([])
  const [filter, setFilter] = useState<'全部' | SessionTag>('全部')

  useDidShow(() => {
    void (async () => {
      setRecords(await listAllSessionRecords())
    })()
  })

  const sorted = [...records].sort((a, b) => (a.date < b.date ? 1 : -1))
  const filtered = sorted.filter(r => filter === '全部' || sessionTag(r) === filter)

  // 演进速览：筛选后，每个动作按时间列出"日期 重量×次数"
  const evolution = useMemo(() => {
    if (filter === '全部') return []
    const byEx = new Map<string, Array<{ date: string; line: string; top: number }>>()
    const chrono = [...filtered].sort((a, b) => (a.date < b.date ? -1 : 1))
    for (const r of chrono) {
      for (const ex of r.exercises) {
        if (ex.sets.length === 0) continue
        const top = Math.max(...ex.sets.map(s => s.weightKg))
        const arr = byEx.get(ex.exerciseId) ?? []
        arr.push({ date: fmtDate(r.date), line: setSummary(ex.sets), top })
        byEx.set(ex.exerciseId, arr)
      }
    }
    return Array.from(byEx.entries())
      .map(([id, lines]) => ({ id, name: exerciseName(id), lines }))
      .filter(x => x.lines.length > 0)
      .sort((a, b) => b.lines.length - a.lines.length)
  }, [filtered, filter])

  return (
    <View className='history-page'>
      <Text className='page-title'>训练历史</Text>
      <Text className='page-sub'>共 {records.length} 次训练</Text>

      {/* 筛选 */}
      <View className='filter-row'>
        {FILTERS.map(f => (
          <Text
            key={f}
            className={`filter-chip ${filter === f ? 'on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </Text>
        ))}
      </View>

      {/* 演进速览（筛选单个类型时出现） */}
      {filter !== '全部' && evolution.length > 0 && (
        <View className='card evo-card'>
          <Text className='sec-label'>演进速览（{filter}日 · 按时间）</Text>
          {evolution.map(ex => (
            <View key={ex.id} className='evo-block'>
              <Text className='evo-name'>{ex.name}</Text>
              {ex.lines.map((l, i) => (
                <Text key={i} className='evo-line num'>
                  {l.date} · {l.line}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* 会话列表 */}
      {filtered.length === 0 && (
        <View className='card empty-card'>
          <Text className='empty-line'>还没有{filter === '全部' ? '' : '这类'}训练记录</Text>
        </View>
      )}
      {filtered.map(r => {
        const tag = sessionTag(r)
        return (
          <View key={r.id} className='card hist-card'>
            <View className='hist-head'>
              <Text className='hist-date num'>{fmtDate(r.date)}</Text>
              <Text className='hist-tag'>{tag}</Text>
              <Text className='hist-name'>{r.workoutName ?? ''}</Text>
              {r.durationMinutes != null && (
                <Text className='hist-dur num'>{r.durationMinutes}min</Text>
              )}
            </View>
            {r.exercises.map((ex, i) => (
              <View key={i} className='hist-ex'>
                <Text className='hist-ex-name'>{exerciseName(ex.exerciseId)}</Text>
                <Text className='hist-ex-sets num'>{setSummary(ex.sets) || '跳过'}</Text>
                {(() => {
                  const rpes = ex.sets.map(s => s.rpe).filter((x): x is number => x != null)
                  return rpes.length > 0 ? (
                    <Text className='hist-ex-rpe num'>RPE {Math.max(...rpes)}</Text>
                  ) : null
                })()}
              </View>
            ))}
            {r.comment && <Text className='hist-note'>{r.comment}</Text>}
            {r.feeling && <Text className='hist-note'>感受：{r.feeling}</Text>}
          </View>
        )
      })}
    </View>
  )
}
