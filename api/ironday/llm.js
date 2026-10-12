/* ironday: LLM 调用封装（OpenAI 兼容端点，原生 fetch，零新依赖）。
 *
 * 与 Coach 的 provider 体系并行存在：Coach 面向"训练计划读写"的重量级流水线，
 * ironday 的三个能力（餐食识别/补剂对话/体检解析）是短平快的单轮调用，
 * 直接走环境变量配置的 OpenAI 兼容端点（GLM/Qwen/DeepSeek 视觉+文本均适用）。
 *
 * 环境变量：
 *   IRONDAY_LLM_BASE_URL   默认 https://open.bigmodel.cn/api/paas/v4
 *   IRONDAY_LLM_KEY        必填（缺失时路由返回 503，与 Coach 的 off 语义一致）
 *   IRONDAY_LLM_MODEL      默认 glm-5.3-flash（原生多模态，文本视觉同模型）
 *   IRONDAY_LLM_VISION_MODEL  可选，默认同 LLM_MODEL
 */

import { safeParseJson } from './domain.js';

function cfg() {
  const baseURL = (process.env.IRONDAY_LLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/+$/, '');
  const apiKey = process.env.IRONDAY_LLM_KEY || '';
  const model = process.env.IRONDAY_LLM_MODEL || 'glm-5.3-flash';
  const visionModel = process.env.IRONDAY_LLM_VISION_MODEL || model;
  return { baseURL, apiKey, model, visionModel };
}

export function irondayConfigured() {
  return !!cfg().apiKey;
}

/** 单轮文本调用（system 并入首条 user，兼容不支持 system 角色的小端点）。 */
export async function chat(system, user, { temperature = 0.5, json = false } = {}) {
  const c = cfg();
  const res = await fetch(`${c.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.apiKey}` },
    body: JSON.stringify({
      model: c.model,
      messages: [{ role: 'user', content: `${system}\n\n${user}` }],
      temperature,
      ...(json ? { response_format: { type: 'json_object' } } : {})
    })
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    usage: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0
    }
  };
}

/** 单轮视觉调用（data URL 图片）。JSON 约束靠提示词，不传 response_format（兼容面最大）。 */
export async function chatVision(system, user, imageDataUrl, { temperature = 0.3 } = {}) {
  const c = cfg();
  const res = await fetch(`${c.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.apiKey}` },
    body: JSON.stringify({
      model: c.visionModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${system}\n\n${user}` },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }],
      temperature
    })
  });
  if (!res.ok) throw new Error(`Vision HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    usage: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0
    }
  };
}

/** chat + 剥围栏 + JSON.parse 的组合（三个能力共用）。 */
export async function chatJson(system, user, opts = {}) {
  const r = await chat(system, user, { ...opts, json: false });
  return { parsed: safeParseJson(r.text), usage: r.usage };
}
