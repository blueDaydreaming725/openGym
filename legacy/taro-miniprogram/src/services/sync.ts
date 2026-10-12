import { post, BASE_URL } from './request'
import type { CycleReviewProposal, HealthMetric } from '../types/agent'
import type { DietRecord, SessionRecord, TrainingPlan } from '../types/models'

/**
 * 数据上行同步（本地优先架构的备份通道）
 * 服务器不可达 / BASE_URL 未配置时静默跳过——本地数据始终是第一真相源。
 */

const SYNC_ON = !BASE_URL.includes('YOUR_SERVER')

async function pushQuietly(path: string, body: unknown): Promise<void> {
  if (!SYNC_ON) return
  try {
    await post(path, body as Record<string, unknown>)
  } catch (err) {
    console.warn(`[sync] ${path} 失败（本地不受影响）:`, err instanceof Error ? err.message : err)
  }
}

export function syncPlan(plan: TrainingPlan): void {
  void pushQuietly(`/plans/${plan.id}`, plan)
}

export function syncRecord(record: SessionRecord): void {
  void pushQuietly(`/records/${record.id}`, record)
}

export function syncReview(review: CycleReviewProposal): void {
  void pushQuietly(`/reviews/${review.id}`, review)
}

export function syncDiet(record: DietRecord): void {
  void pushQuietly(`/diet/${record.id}`, record)
}

export type { HealthMetric }
