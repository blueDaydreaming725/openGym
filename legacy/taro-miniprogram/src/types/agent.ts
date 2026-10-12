/**
 * Agent 领域类型：周期复盘提案、护栏、追踪、记忆、体检指标（本地）
 */
import type { ExerciseAdjustment, GuardrailRules } from '../core/progression'

/** agent 单步轨迹（对应 codecare 的 trace hooks） */
export interface AgentStepTrace {
  step: number
  textDelta?: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  /** 本步 token 用量（可选） */
  tokens?: number
}

/** agent 停止原因（对齐 codecare 的语义化枚举） */
export type AgentStopReason = 'completed' | 'max_steps' | 'token_budget' | 'loop_detected'

/** 周期复盘提案（agent 或规则版产出，确认后生效） */
export interface CycleReviewProposal {
  id: string
  cycleId: string
  planId: string
  /** 生成来源：agent（LLM 为主）/ rule（规则兜底） */
  source: 'agent' | 'rule-fallback'
  /** 完成率 0~1 */
  completionRate: number
  /** 平均 RPE */
  avgRpe?: number
  /** 教练总结（LLM 生成；规则版为模板拼接） */
  summaryText: string
  /** 决策依据（每条可读） */
  rationale: string[]
  /** 下周期调整清单（用户逐项可改） */
  adjustments: ExerciseAdjustment[]
  /** 警示（护栏拦截/疼痛/数据缺失等） */
  warnings: string[]
  /** 生成时间（ISO 8601） */
  createdAt: string
  /** 用户确认时间；未确认 = 待处理 */
  confirmedAt?: string
}

/** agent 运行配置（M2 云函数侧使用） */
export interface AgentRuntimeConfig {
  maxSteps: number
  tokenBudget: number
  maxRetries: number
  guardrails: GuardrailRules
  model: {
    /** OpenAI 兼容端点（DeepSeek/Qwen 可切换） */
    baseURL: string
    apiKey: string
    model: string
  }
}

/** agent 记忆条目（M2：存云数据库；type 对齐 codecare 四分类的领域化版本） */
export interface MemoryItem {
  id: string
  type: 'user' | 'coaching' | 'plan-history' | 'health-reference'
  content: string
  createdAt: string
  lastReadAt?: string
}

/** 体检指标（★仅存设备本地，永不上云；LLM 解析走阅后即焚云函数） */
export type HealthFlag = 'normal' | 'low' | 'high' | 'critical'

export interface HealthMetric {
  /** 指标键，如 liver_alt / kidney_egfr / uric_acid / blood_pressure_high / vitamin_d */
  key: string
  label: string
  value: number
  unit: string
  flag: HealthFlag
  /** 体检报告日期 */
  recordedAt: string
}

/** 阅后即焚解析请求体（发给云函数，服务端不落库不留日志） */
export interface HealthParseRequest {
  /** 报告文本（OCR 或粘贴） */
  text: string
}
