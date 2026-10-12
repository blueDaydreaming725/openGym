/* ironday: HTTP 路由（挂进 server.js 的 routes 表，风格对齐 coach/routes.js）。
 *
 * 与 Coach 不同，这三个能力不进任务队列：都是单轮、秒级返回的调用，
 * 排队反而把交互（拍照确认/对话）拖坏。限流沿用 server 级的 session 校验。
 * 体检解析是"阅后即焚"：请求体只过内存，不落任何文件与日志（domain 里的
 * classifyMetric 做结果兜底，报告原文离开 LLM 即消失）。
 */
import { chat, chatVision, irondayConfigured } from './llm.js';
import { chatJson } from './llm.js';
import {
  classifyMetric, HEALTH_RANGES, ruleBasedSupplements, safeParseJson, SUPPLEMENT_DISCLAIMER
} from './domain.js';

const MEAL_SYSTEM = `你是营养识别助手。识别照片中的食物，输出 JSON：
{"foods":[{"name":"食物名","portion":"份量描述","calories":120}],"comment":"一句话合理性与建议"}
单一食物 calories 为该份量估算千卡（整数）；混合菜品拆成主要组成；看不清的写"未知食物"并给保守估计；
comment 控制在 60 字内。只输出 JSON。`;

const HEALTH_SYSTEM = `你是体检报告解析助手。从输入提取体检指标，输出 JSON：
{"metrics":[{"key":"","label":"","value":0,"unit":"","flag":"normal|low|high|critical"}]}
可用 key：${Object.keys(HEALTH_RANGES).join('、')}。
flag 按参考范围判定：低于 low 为 low，高于 high 为 high，明显超出为 critical。
只提取能确定的指标，没有则空数组。只输出 JSON。`;

const suppChatSystem = (ctx) => `你是用户的私人营养师，专注补剂与恢复。用户数据：
${JSON.stringify(ctx)}
口语化简洁（一般不超 200 字）；给具体建议时遵守循证剂量与安全限制（肾功能异常不推肌酸与高蛋白、血压高不推咖啡因、剂量用具体数字）；
当你在回复中给出明确的每日补剂方案时，在回复最末尾为每个补剂追加一行，格式：[PLAN] 名称|剂量|时机；没有方案就不加。`;

export function irondayRoutes({ json, readBody, readSession }) {
  const guard = (req, res) => {
    if (!readSession(req)) { json(res, 401, { error: 'not signed in' }); return false; }
    if (!irondayConfigured()) { json(res, 503, { error: 'ironday LLM not configured', code: 'off' }); return false; }
    return true;
  };

  return {
    /* 拍照算卡路里：data URL in，结构化食物清单 out */
    'POST /api/ironday/meal-parse': async (req, res) => {
      if (!guard(req, res)) return;
      const body = await readBody(req);
      const { imageDataUrl } = body || {};
      if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
        return json(res, 400, { error: 'imageDataUrl required' });
      }
      if (imageDataUrl.length > 6_000_000) return json(res, 413, { error: 'image too large' });
      try {
        const r = await chatVision(MEAL_SYSTEM, '识别这张餐食照片，按规则输出 JSON。', imageDataUrl);
        const parsed = safeParseJson(r.text);
        const foods = (parsed.foods || [])
          .filter((f) => f.name && Number(f.calories) > 0)
          .map((f) => ({ name: String(f.name), portion: f.portion || '', calories: Math.round(Number(f.calories)) }));
        json(res, 200, { foods, comment: parsed.comment || '' });
      } catch (e) {
        json(res, 502, { error: e.message });
      }
    },

    /* 体检指标解析（阅后即焚）：文字或照片 → 结构化指标；flag 以规则表兜底 */
    'POST /api/ironday/health-parse': async (req, res) => {
      if (!guard(req, res)) return;
      const body = await readBody(req);
      const { text, imageDataUrl } = body || {};
      const hasText = typeof text === 'string' && text.trim().length > 20;
      const hasImg = typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/');
      if (!hasText && !hasImg) return json(res, 400, { error: 'text (>=20 chars) or imageDataUrl required' });
      try {
        const r = hasImg
          ? await chatVision(HEALTH_SYSTEM, '解析这张体检报告照片中的指标，按规则输出 JSON。', imageDataUrl)
          : await chat(HEALTH_SYSTEM, text.slice(0, 4000), { temperature: 0.2 });
        const parsed = safeParseJson(r.text);
        const metrics = (parsed.metrics || [])
          .filter((m) => m.label && Number(m.value) > 0)
          .map((m) => {
            const value = Math.round(Number(m.value) * 100) / 100;
            const key = HEALTH_RANGES[m.key] ? m.key : `custom_${String(m.key || m.label).slice(0, 30)}`;
            return {
              key, label: String(m.label).slice(0, 30), value,
              unit: m.unit || HEALTH_RANGES[m.key]?.unit || '',
              flag: classifyMetric(m.key, value)
            };
          });
        json(res, 200, { metrics });
      } catch (e) {
        json(res, 502, { error: e.message });
      }
    },

    /* 补剂对话：体检指标+训练上下文 → 营养师聊天；规则基础盘随响应附带（前端可对照） */
    'POST /api/ironday/supplement-chat': async (req, res) => {
      if (!guard(req, res)) return;
      const body = await readBody(req);
      const { messages, context } = body || {};
      if (!Array.isArray(messages) || !messages.length) return json(res, 400, { error: 'messages required' });
      try {
        const history = messages
          .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
          .slice(-12);
        if (!history.length) return json(res, 400, { error: 'no valid messages' });
        const transcript = history.map((m) => `${m.role === 'user' ? '用户' : '你'}：${m.content}`).join('\n');
        const r = await chat(suppChatSystem(context || {}), transcript, { temperature: 0.6 });
        json(res, 200, {
          reply: r.text,
          baseline: ruleBasedSupplements(context || {}),
          disclaimer: SUPPLEMENT_DISCLAIMER
        });
      } catch (e) {
        json(res, 502, { error: e.message });
      }
    }
  };
}
