import 'dotenv/config'
import { watchFile } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

function required(name: string, fallback?: string): string {
  const v = process.env[name]?.trim() || fallback
  if (!v) throw new Error(`缺少环境变量 ${name}（参考 .env.example）`)
  return v
}

/** 服务配置；.env 修改后 30 秒内自动热重载（无需重启 pm2/launchd） */
export const config = {
  port: Number(process.env.PORT ?? 3300),
  apiToken: required('API_TOKEN', 'change-me-to-a-long-random-string'),
  dbPath: process.env.DB_PATH?.trim() || 'data/app.db',
  llm: {
    baseURL: process.env.LLM_BASE_URL?.trim() || 'https://api.deepseek.com',
    apiKey: process.env.LLM_API_KEY?.trim() ?? '',
    model: process.env.LLM_MODEL?.trim() || 'deepseek-chat',
  },
  /** 视觉模型（拍照算卡路里）；默认阿里 DashScope qwen-vl（OpenAI 兼容端点） */
  vision: {
    baseURL: process.env.VISION_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.VISION_API_KEY?.trim() ?? '',
    model: process.env.VISION_MODEL?.trim() || 'qwen-vl-plus',
  },
}

// 运行时本文件在 dist/ 下，server 根目录 = dist 的上一级
const envFile = resolve(dirname(fileURLToPath(import.meta.url)), '../.env')
watchFile(envFile, () => {
  // 显式清掉旧值，让 override 模式重新读取
  delete process.env.VISION_API_KEY
  delete process.env.LLM_API_KEY
  delete process.env.LLM_BASE_URL
  delete process.env.LLM_MODEL
  delete process.env.VISION_BASE_URL
  delete process.env.VISION_MODEL
  import('dotenv').then(d => {
    d.config({ override: true, path: envFile })
    config.llm.baseURL = process.env.LLM_BASE_URL?.trim() || config.llm.baseURL
    config.llm.apiKey = process.env.LLM_API_KEY?.trim() ?? ''
    config.llm.model = process.env.LLM_MODEL?.trim() || config.llm.model
    config.vision.baseURL = process.env.VISION_BASE_URL?.trim() || config.vision.baseURL
    config.vision.apiKey = process.env.VISION_API_KEY?.trim() ?? ''
    config.vision.model = process.env.VISION_MODEL?.trim() || config.vision.model
    console.log('[config] .env 已热重载')
  })
})
