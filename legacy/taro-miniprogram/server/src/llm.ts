import { config } from './config.js'
import { db } from './db.js'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  text: string
  usage: { inputTokens: number; outputTokens: number }
}

/** 记录一笔 LLM 用量（成本可见：llm_usage 表） */
export function recordUsage(scene: string, model: string, usage: ChatResult['usage']): void {
  db.prepare(
    'INSERT INTO llm_usage (scene, model, input_tokens, output_tokens) VALUES (?, ?, ?, ?)',
  ).run(scene, model, usage.inputTokens, usage.outputTokens)
}

/** OpenAI 兼容 chat completion（DeepSeek/Qwen/Kimi 可切换） */
export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; jsonMode?: boolean } = {},
): Promise<ChatResult> {
  if (!config.llm.apiKey) {
    throw new Error('LLM_API_KEY 未配置（.env）')
  }
  const res = await fetch(`${config.llm.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.llm.apiKey}`,
    },
    body: JSON.stringify({
      model: config.llm.model,
      messages,
      temperature: opts.temperature ?? 0.7,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`LLM 请求失败 HTTP ${res.status}: ${detail.slice(0, 300)}`)
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
    usage: { prompt_tokens: number; completion_tokens: number }
  }
  return {
    text: data.choices[0]?.message?.content ?? '',
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  }
}

/** 视觉识别（兼容多家 OpenAI 格式端点：qwen-vl / glm-4v / kimi-vision…）
    保守起见不用 system 角色与 response_format（部分厂商不支持），要求 JSON 全靠提示词 */
export async function chatVision(
  system: string,
  userText: string,
  imageDataUrl: string,
): Promise<ChatResult> {
  const baseURL = config.vision.baseURL
  if (!config.vision.apiKey) {
    throw new Error('VISION_API_KEY 未配置（.env，可用 qwen-vl / glm-4v / kimi-vision 系列）')
  }
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.vision.apiKey}`,
    },
    body: JSON.stringify({
      model: config.vision.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${system}\n\n${userText}` },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.3,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Vision 请求失败 HTTP ${res.status}: ${detail.slice(0, 300)}`)
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
    usage: { prompt_tokens: number; completion_tokens: number }
  }
  return {
    text: data.choices[0]?.message?.content ?? '',
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  }
}
