import { request } from './request'

/** M2 agent 端点封装（拍照算卡路里 / 补剂推荐） */

export interface ParsedFood {
  name: string
  portion: string
  calories: number
}

export interface MealParseResult {
  foods: ParsedFood[]
  comment: string
  source: 'vision'
}

/** 拍照识别（视觉 LLM 在服务器上；40s 超时，qwen-vl 一般 3-8s） */
export async function parseMeal(imageDataUrl: string): Promise<MealParseResult> {
  return request<MealParseResult>({
    url: '/agent/meal-parse',
    method: 'POST',
    data: { imageDataUrl },
    timeout: 40000,
  })
}

export interface SupplementRecItem {
  name: string
  dosage: string
  timing: string
  reason: string
}

export interface SupplementRecResult {
  items: SupplementRecItem[]
  summary: string
  warnings: string[]
  disclaimer: string
  source: 'agent' | 'rule-fallback'
}

export interface SupplementRecInput {
  healthMetrics: Array<{ key: string; label: string; value: number; unit: string; flag: string }>
  planSummary?: string
  subjective?: string
  weightKg?: number
  goal?: 'cut' | 'bulk' | 'maintain'
}

/** 补剂推荐（服务端规则打底 + LLM 个性化；LLM 未配置自动降级规则版） */
export async function supplementRec(input: SupplementRecInput): Promise<SupplementRecResult> {
  return request<SupplementRecResult>({
    url: '/agent/supplement-rec',
    method: 'POST',
    data: input as unknown as Record<string, unknown>,
    timeout: 40000,
  })
}

export interface ParsedHealthMetric {
  key: string
  label: string
  value: number
  unit: string
  flag: string
}

/** 体检报告解析（文字或照片；服务端阅后即焚，不落库） */
export async function healthParse(
  text?: string,
  imageDataUrl?: string,
): Promise<{ metrics: ParsedHealthMetric[]; source: string }> {
  return request<{ metrics: ParsedHealthMetric[]; source: string }>({
    url: '/agent/health-parse',
    method: 'POST',
    data: { text, imageDataUrl },
    timeout: 60000,
  })
}

export interface SupplementChatMsg {
  role: 'user' | 'assistant'
  content: string
}

/** AI 营养师对话（上下文由服务端注入系统提示） */
export async function supplementChat(
  messages: SupplementChatMsg[],
  context: Record<string, unknown>,
): Promise<{ reply: string }> {
  return request<{ reply: string }>({
    url: '/agent/supplement-chat',
    method: 'POST',
    data: { messages, context },
    timeout: 60000,
  })
}
