/**
 * 数据仓库（本地优先）
 * 接口与未来的云数据库版同构（全部 async），M2 上云时仅替换实现层。
 * 体检指标（healthMetrics）只存本地，见 types/agent.ts 的约束说明。
 */
import Taro from '@tarojs/taro'
import type {
  CycleReviewProposal,
  HealthMetric,
  MemoryItem,
} from '../types/agent'
import type {
  DietRecord,
  KnowledgeEntry,
  SessionRecord,
  SupplementPlan,
  TrainingPlan,
  Workout,
} from '../types/models'
import { genId } from '../core/plan-templates'
import { syncPlan, syncRecord, syncReview, syncDiet } from './sync'

const KEYS = {
  plans: 'fa:plans',
  records: 'fa:session-records',
  reviews: 'fa:cycle-reviews',
  profile: 'fa:profile',
  healthMetrics: 'fa:health-metrics', // ★ 本地-only
  memories: 'fa:memories',
  diet: 'fa:diet-records',
  supplements: 'fa:supplement-plans',
  knowledge: 'fa:knowledge',
} as const

// ── 基础存储封装 ──

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const res = await Taro.getStorage({ key })
    return (res.data as T) ?? fallback
  } catch {
    return fallback
  }
}

async function save<T>(key: string, value: T): Promise<void> {
  await Taro.setStorage({ key, data: value })
}

// ── 训练域 ──

export async function listPlans(): Promise<TrainingPlan[]> {
  return load<TrainingPlan[]>(KEYS.plans, [])
}

export async function savePlan(plan: TrainingPlan): Promise<void> {
  const plans = await load<TrainingPlan[]>(KEYS.plans, [])
  const idx = plans.findIndex(p => p.id === plan.id)
  if (idx >= 0) plans[idx] = plan
  else plans.push(plan)
  await save(KEYS.plans, plans)
  syncPlan(plan)
}

export async function deletePlan(planId: string): Promise<void> {
  const plans = await load<TrainingPlan[]>(KEYS.plans, [])
  await save(KEYS.plans, plans.filter(p => p.id !== planId))
}

/** 取某个周期的训练模板列表 */
export async function getWorkouts(cycleId: string): Promise<Workout[]> {
  const plans = await listPlans()
  for (const p of plans) {
    const cyc = p.cycles.find(c => c.id === cycleId)
    if (cyc) return cyc.workouts
  }
  return []
}

// ── 训练会话 ──

/** 开始本次训练：由模板 Workout 生成动作实例清单（用户可在准备页增删替换后再开始） */
export async function startSession(
  planId: string,
  cycleId: string,
  workout: Workout,
): Promise<SessionRecord> {
  const session: SessionRecord = {
    id: genId('sess'),
    planId,
    cycleId,
    workoutName: workout.name,
    date: new Date().toISOString().slice(0, 10),
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    exercises: workout.items.map(it => ({
      exerciseId: it.exerciseId,
      plannedSets: it.sets,
      targetRepMin: it.repRangeMin,
      targetRepMax: it.repRangeMax,
      targetWeightKg: it.targetWeightKg,
      restSeconds: it.restSeconds ?? 90,
      sets: [],
    })),
  }
  const records = await load<SessionRecord[]>(KEYS.records, [])
  records.push(session)
  await save(KEYS.records, records)
  return session
}

export async function getSession(sessionId: string): Promise<SessionRecord | undefined> {
  const records = await load<SessionRecord[]>(KEYS.records, [])
  return records.find(r => r.id === sessionId)
}

/** 保存进行中的会话（每完成一组都调用，支持杀进程恢复） */
export async function saveSession(session: SessionRecord): Promise<void> {
  const records = await load<SessionRecord[]>(KEYS.records, [])
  const idx = records.findIndex(r => r.id === session.id)
  if (idx >= 0) records[idx] = session
  else records.push(session)
  await save(KEYS.records, records)
  syncRecord(session)
}

/** 获取未完成的会话（用于"继续上一次训练"） */
export async function getActiveSession(): Promise<SessionRecord | undefined> {
  const records = await load<SessionRecord[]>(KEYS.records, [])
  return records.find(r => r.status === 'in_progress')
}

/** 全部已完成会话（跨周期，日历用） */
export async function listAllSessionRecords(): Promise<SessionRecord[]> {
  const records = await load<SessionRecord[]>(KEYS.records, [])
  return records.filter(r => r.status === 'completed')
}

export async function listSessionRecords(cycleId: string): Promise<SessionRecord[]> {
  const records = await load<SessionRecord[]>(KEYS.records, [])
  return records
    .filter(r => r.cycleId === cycleId && r.status === 'completed')
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

// ── 周期复盘 ──

export async function saveReview(review: CycleReviewProposal): Promise<void> {
  const reviews = await load<CycleReviewProposal[]>(KEYS.reviews, [])
  const idx = reviews.findIndex(r => r.id === review.id)
  if (idx >= 0) reviews[idx] = review
  else reviews.push(review)
  await save(KEYS.reviews, reviews)
  syncReview(review)
}

export async function getLatestReview(cycleId: string): Promise<CycleReviewProposal | undefined> {
  const reviews = await load<CycleReviewProposal[]>(KEYS.reviews, [])
  return reviews
    .filter(r => r.cycleId === cycleId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
}

// ── 个人档案 / 体检指标（本地）──

export interface UserProfile {
  heightCm?: number
  weightKg?: number
  age?: number
  sex?: 'male' | 'female'
  /** 减脂的热量缺口目标（默认 400） */
  calorieDeficit?: number
}

export async function getProfile(): Promise<UserProfile> {
  return load<UserProfile>(KEYS.profile, {})
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await save(KEYS.profile, profile)
}

/** ★ 体检指标：仅本地存储，导出/上云接口不包含此键 */
export async function getHealthMetrics(): Promise<HealthMetric[]> {
  return load<HealthMetric[]>(KEYS.healthMetrics, [])
}

export async function saveHealthMetrics(metrics: HealthMetric[]): Promise<void> {
  await save(KEYS.healthMetrics, metrics)
}

// ── 饮食 / 补剂 / 知识库 ──

export async function listDietRecords(date?: string): Promise<DietRecord[]> {
  const all = await load<DietRecord[]>(KEYS.diet, [])
  return date ? all.filter(d => d.date === date) : all
}

export async function saveDietRecord(record: DietRecord): Promise<void> {
  const all = await load<DietRecord[]>(KEYS.diet, [])
  all.push(record)
  await save(KEYS.diet, all)
  syncDiet(record)
}

export async function deleteDietRecord(id: string): Promise<void> {
  const all = await load<DietRecord[]>(KEYS.diet, [])
  await save(KEYS.diet, all.filter(d => d.id !== id))
}

// ── 个人食物库（常用食物：识别结果"存为常用"沉淀于此）──

export interface FavoriteFood {
  name: string
  portion?: string
  calories: number
}

const FAV_KEY = 'fa:favorite-foods'

export async function listFavoriteFoods(): Promise<FavoriteFood[]> {
  return load<FavoriteFood[]>(FAV_KEY, [])
}

export async function saveFavoriteFoods(list: FavoriteFood[]): Promise<void> {
  await save(FAV_KEY, list)
}

export async function listSupplementPlans(): Promise<SupplementPlan[]> {
  return load<SupplementPlan[]>(KEYS.supplements, [])
}

export async function saveSupplementPlan(plan: SupplementPlan): Promise<void> {
  const all = await load<SupplementPlan[]>(KEYS.supplements, [])
  const idx = all.findIndex(p => p.id === plan.id)
  if (idx >= 0) all[idx] = plan
  else all.push(plan)
  await save(KEYS.supplements, all)
}

export async function listKnowledge(): Promise<KnowledgeEntry[]> {
  return load<KnowledgeEntry[]>(KEYS.knowledge, [])
}

export async function saveKnowledge(entry: KnowledgeEntry): Promise<void> {
  const all = await load<KnowledgeEntry[]>(KEYS.knowledge, [])
  const idx = all.findIndex(k => k.id === entry.id)
  if (idx >= 0) all[idx] = entry
  else all.push(entry)
  await save(KEYS.knowledge, all)
}

/** agent 记忆（M2 移到云数据库；本地先用同构接口） */
export async function listMemories(): Promise<MemoryItem[]> {
  return load<MemoryItem[]>(KEYS.memories, [])
}

export async function saveMemory(item: MemoryItem): Promise<void> {
  const all = await load<MemoryItem[]>(KEYS.memories, [])
  all.push(item)
  await save(KEYS.memories, all)
}
