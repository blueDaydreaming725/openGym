/**
 * 会话展示工具：分类标签、每组概括（首页日历与训练历史共用）
 */
import type { SessionRecord } from '../types/models'
import { getExercise } from './exercise-library'

export type SessionTag = '推' | '拉' | '腿' | '有' | '其他'

const MUSCLE_LABEL: Record<string, string> = {
  胸: '推', 肩: '推', 手臂: '推', 背: '拉', 腿: '腿', 核心: '核', 有氧: '有',
}

/** 会话分类：优先取训练日名首字（推日/拉日/腿日），否则按主要肌群归类 */
export function sessionTag(r: SessionRecord): SessionTag {
  if (r.workoutName) {
    const c = r.workoutName[0]
    if (c === '推' || c === '拉' || c === '腿') return c
    if (c === '有' || r.workoutName.includes('有氧')) return '有'
  }
  const counts: Record<string, number> = {}
  for (const ex of r.exercises) {
    const mg = getExercise(ex.exerciseId)?.muscleGroup
    if (mg) counts[mg] = (counts[mg] ?? 0) + 1
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (top && MUSCLE_LABEL[top] === '推') return '推'
  if (top && MUSCLE_LABEL[top] === '拉') return '拉'
  if (top === '腿') return '腿'
  if (top === '有氧') return '有'
  return '其他'
}

/** 单个动作的组次概括："50kg×8×3 + 45kg×10" */
export function setSummary(
  sets: Array<{ weightKg: number; reps: number }>,
): string {
  if (sets.length === 0) return ''
  const groups = new Map<string, number>()
  for (const s of sets) {
    const k = `${s.weightKg}kg×${s.reps}`
    groups.set(k, (groups.get(k) ?? 0) + 1)
  }
  return Array.from(groups.entries())
    .map(([k, n]) => (n > 1 ? `${k}×${n}` : k))
    .join(' + ')
}

/** 动作名 */
export function exerciseName(id: string): string {
  return getExercise(id)?.name ?? id
}
