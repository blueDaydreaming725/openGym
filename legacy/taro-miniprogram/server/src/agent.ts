import { Router } from 'express'
import { chat, chatVision, recordUsage } from './llm.js'
import { config } from './config.js'

export const agentRouter = Router()

// ── 拍照算卡路里：视觉模型 → 结构化食物清单 ──

const MEAL_SYSTEM = `你是营养识别助手。识别照片中的食物，输出 JSON：
{"foods":[{"name":"食物名","portion":"份量描述","calories":120}],"comment":"一句话合理性与建议"}
规则：单一食物 calories 为该份量的估算千卡（整数）；混合菜品拆成主要组成；看不清的写"未知食物"并给保守估计；
comment 控制在 60 字内，指出份量不确定处或搭配问题；只输出 JSON，不要解释。`

/** 剥掉模型可能包裹的 ```json 围栏再解析 */
function safeParseJson(text: string): unknown {
  const stripped = text.trim().replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(stripped)
}

agentRouter.post('/meal-parse', async (req, res) => {
  const { imageDataUrl } = req.body ?? {}
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    res.status(400).json({ code: 400, message: '缺少 imageDataUrl（data:image/... base64）', data: null })
    return
  }
  if (imageDataUrl.length > 6_000_000) {
    res.status(413).json({ code: 413, message: '图片过大，请压缩后重试', data: null })
    return
  }
  try {
    const result = await chatVision(
      MEAL_SYSTEM,
      '识别这张餐食照片，按系统规则输出 JSON。',
      imageDataUrl,
    )
    recordUsage('meal-parse', config.vision.model, result.usage)
    const parsed = safeParseJson(result.text) as {
      foods?: Array<{ name?: string; portion?: string; calories?: number }>
      comment?: string
    }
    const foods = (parsed.foods ?? [])
      .filter(f => f.name && typeof f.calories === 'number' && f.calories > 0)
      .map(f => ({ name: String(f.name), portion: f.portion ?? '', calories: Math.round(f.calories as number) }))
    res.json({
      code: 0,
      message: 'ok',
      data: { foods, comment: parsed.comment ?? '', source: 'vision' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = msg.includes('未配置') ? 503 : 502
    res.status(status).json({ code: status, message: msg, data: null })
  }
})

// ── 补剂推荐：规则引擎打底 → LLM 个性化 → 护栏校验 ──
// 规则来源：docs/research/domain-notes.md §6/§7（循证剂量 + 体检冲突表）

interface HealthMetricInput { key: string; label: string; value: number; unit: string; flag: 'normal' | 'low' | 'high' | 'critical' }
interface SupplementRec { name: string; dosage: string; timing: string; reason: string }
interface RecRequest {
  healthMetrics?: HealthMetricInput[]
  planSummary?: string
  subjective?: string
  weightKg?: number
  goal?: 'cut' | 'bulk' | 'maintain'
}

function ruleBasedRecommendation(req: RecRequest): { items: SupplementRec[]; warnings: string[] } {
  const items: SupplementRec[] = []
  const warnings: string[] = []
  const m = new Map((req.healthMetrics ?? []).map(x => [x.key, x]))

  const kidney = m.get('kidney_egfr')?.flag === 'high' || m.get('kidney_creatinine')?.flag === 'high' || m.get('kidney_egfr')?.flag === 'critical'
  const uricHigh = m.get('uric_acid')?.flag === 'high' || m.get('uric_acid')?.flag === 'critical'
  const bpHigh = m.get('blood_pressure_high')?.flag === 'high' || m.get('blood_pressure_high')?.flag === 'critical'
  const vitD = m.get('vitamin_d')

  if (!kidney) {
    items.push({ name: '肌酸一水合物', dosage: '5g/天', timing: '训练日练后随餐，休息日任意', reason: 'Tier 1 循证：力量与瘦体重，无需冲击期' })
  } else {
    warnings.push('肾功能指标异常：肌酸与高蛋白摄入需医生确认后进行，未纳入推荐')
  }
  items.push({ name: '蛋白粉', dosage: req.weightKg ? `每日总量补足至 ${(req.weightKg * 1.6).toFixed(0)}-${(req.weightKg * 2.2).toFixed(0)}g 蛋白` : '每日总量补足至 1.6-2.2g/kg 体重', timing: '练后或早餐蛋白缺口', reason: 'Tier 1：训练人群蛋白需求 1.6-2.2g/kg/天' })
  if (!bpHigh) {
    items.push({ name: '咖啡因', dosage: '3-6mg/kg（约 200-400mg）', timing: '练前 60 分钟，14:00 后避免', reason: 'Tier 1：耐力与力量表现；减脂期兼作提神' })
  } else {
    warnings.push('血压偏高：咖啡因未纳入推荐')
  }
  if (vitD && (vitD.flag === 'low' || vitD.flag === 'critical')) {
    items.push({ name: '维生素 D3', dosage: '2000IU/天', timing: '随含脂肪的正餐', reason: `体检 25(OH)D ${vitD.value}${vitD.unit} 偏低` })
  }
  items.push({ name: '鱼油 EPA+DHA', dosage: '1-3g/天（合计）', timing: '随餐', reason: 'Tier 2：心血管与恢复支持' })
  items.push({ name: '镁（甘氨酸镁）', dosage: '200-400mg/天', timing: '睡前', reason: 'Tier 2：睡眠与神经恢复' })

  if (uricHigh) warnings.push('尿酸偏高：蛋白粉选乳清适量摄入，肌酸使用前建议咨询医生')
  if (req.goal === 'cut') {
    items.push({ name: '电解质', dosage: '训练日出汗多时 1 份', timing: '练中/练后', reason: '热量缺口期大量出汗时补充钠钾' })
  }
  return { items, warnings }
}

const REC_SYSTEM = `你是循证营养顾问。基于规则引擎的基础方案与用户数据，输出最终每日补剂方案 JSON：
{"items":[{"name":"","dosage":"","timing":"","reason":""}],"summary":"两句话总体说明"}
硬性规则：只能调整基础方案里的条目和理由，不得新增补剂；不得越过任何"未纳入/需医生确认"的限制；
剂量不得改动；reason 一句话说清为什么适合此人；summary 提醒"非医疗建议"。只输出 JSON。`

agentRouter.post('/supplement-rec', async (req, res) => {
  const rec = (req.body ?? {}) as RecRequest
  const base = ruleBasedRecommendation(rec)
  const disclaimer = '本方案基于公开运动营养学证据与您主动提供的资料生成，仅供健康成年人参考，不构成医疗建议；如有疾病或用药请遵医嘱。'

  try {
    const result = await chat(
      [
        { role: 'system', content: REC_SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            基础方案: base.items,
            限制与警示: base.warnings,
            用户数据: { 体重kg: rec.weightKg, 目标: rec.goal ?? 'maintain', 体检指标: rec.healthMetrics ?? [], 训练概要: rec.planSummary ?? '', 主观感受: rec.subjective ?? '' },
          }),
        },
      ],
      { temperature: 0.4 },
    )
    recordUsage('supplement-rec', config.llm.model, result.usage)
    const parsed = safeParseJson(result.text) as { items?: SupplementRec[]; summary?: string }
    const items = (parsed.items ?? base.items).slice(0, 10)
    res.json({ code: 0, message: 'ok', data: { items, summary: parsed.summary ?? '', warnings: base.warnings, disclaimer, source: 'agent' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // 降级：LLM 不可用时直接给规则版（功能不缺，只是少了个性化话术）
    if (msg.includes('未配置')) {
      res.json({ code: 0, message: 'ok', data: { items: base.items, summary: '（LLM 未配置，当前为纯规则版推荐）', warnings: base.warnings, disclaimer, source: 'rule-fallback' } })
      return
    }
    res.status(502).json({ code: 502, message: msg, data: null })
  }
})

// ── 体检报告解析（文字/照片 → 结构化指标）：阅后即焚，不落库不留日志 ──

const HEALTH_PARSE_SYSTEM = `你是体检报告解析助手。从输入中提取体检指标，输出 JSON：
{"metrics":[{"key":"","label":"","value":0,"unit":"","flag":"normal|low|high|critical"}]}
可用 key 与参考范围（判定 flag 用）：
kidney_egfr 肾功能eGFR 正常90-120；kidney_creatinine 肌酐 正常57-97；liver_alt 谷丙转氨酶 正常9-50；
uric_acid 尿酸 正常208-428；blood_pressure_high 收缩压 正常90-139；vitamin_d 25(OH)D 正常30-100；
hemoglobin 血红蛋白 正常130-175；blood_lipids 总胆固醇 正常<5.2。
超出范围→high/low（方向对应），明显异常→critical，正常范围内→normal。
只提取能从内容确定的指标（按上面 key 命名），没有则输出空数组。单位跟随报告。只输出 JSON。`

agentRouter.post('/health-parse', async (req, res) => {
  const { text, imageDataUrl } = req.body ?? {}
  const hasText = typeof text === 'string' && text.trim().length > 20
  const hasImg = typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/')
  if (!hasText && !hasImg) {
    res.status(400).json({ code: 400, message: '需提供 text（≥20字）或 imageDataUrl', data: null })
    return
  }
  try {
    let result
    if (hasImg) {
      result = await chatVision(
        HEALTH_PARSE_SYSTEM,
        '解析这张体检报告照片中的指标，按系统规则输出 JSON。',
        imageDataUrl,
      )
    } else {
      result = await chat(
        [
          { role: 'system', content: HEALTH_PARSE_SYSTEM },
          { role: 'user', content: (text as string).slice(0, 4000) },
        ],
        { temperature: 0.2 },
      )
    }
    recordUsage('health-parse', hasImg ? config.vision.model : config.llm.model, result.usage)
    const parsed = safeParseJson(result.text) as {
      metrics?: Array<{ key?: string; label?: string; value?: number; unit?: string; flag?: string }>
    }
    const flags = new Set(['normal', 'low', 'high', 'critical'])
    const metrics = (parsed.metrics ?? [])
      .filter(m => m.label && typeof m.value === 'number' && m.value > 0)
      .map(m => ({
        key: (m.key ?? `custom_${m.label}`).slice(0, 40),
        label: String(m.label).slice(0, 30),
        value: Math.round(m.value as number * 100) / 100,
        unit: m.unit ?? '',
        flag: flags.has(m.flag ?? '') ? (m.flag as string) : 'normal',
      }))
    res.json({ code: 0, message: 'ok', data: { metrics, source: hasImg ? 'vision' : 'text' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = msg.includes('未配置') ? 503 : 502
    res.status(status).json({ code: status, message: msg, data: null })
  }
})

// ── 补剂对话：私人营养师聊天（上下文 = 体检指标 + 计划 + 目标） ──

const SUPP_CHAT_SYSTEM = (ctx: string) => `你是用户的私人营养师，专注补剂与恢复。用户数据：
${ctx}
回答要求：口语化、简洁（一般不超过 200 字）；给具体补剂建议时遵守循证剂量与安全限制（肾功能异常不推肌酸与高蛋白、血压高不推咖啡因、剂量用 5g/200mg 这类具体数字）；
当你在回复中给出明确的每日补剂方案时，在回复最末尾为每个补剂追加一行，格式：[PLAN] 名称|剂量|时机；没有方案就不加。`

agentRouter.post('/supplement-chat', async (req, res) => {
  const { messages, context } = req.body ?? {}
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ code: 400, message: 'messages 不能为空', data: null })
    return
  }
  try {
    const history = (messages as Array<{ role: string; content: string }>)
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-12)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    const result = await chat(
      [
        { role: 'system', content: SUPP_CHAT_SYSTEM(JSON.stringify(context ?? {})) },
        ...history,
      ],
      { temperature: 0.6 },
    )
    recordUsage('supplement-chat', config.llm.model, result.usage)
    res.json({ code: 0, message: 'ok', data: { reply: result.text } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = msg.includes('未配置') ? 503 : 502
    res.status(status).json({ code: status, message: msg, data: null })
  }
})
