/* ironday: 领域扩展模块（周期复盘护栏 / 拍照卡路里 / 补剂对话 / 体检指标）。
 *
 * 这些能力在 fork 的 Taro 版里验证过一轮（legacy/taro-miniprogram），此处作为
 * openGym Coach 体系的领域补充：Coach 负责"读训练数据→改计划"的通用循环，
 * 本模块提供它没有的三类事实源与护栏——
 *   1) 周期护栏（guardrails）：任何 LLM 提出的加重方案先过这里，越界即修正；
 *   2) 餐食识别（meal-parse）：视觉模型→结构化食物清单，配合 app 的确认修正闭环；
 *   3) 补剂对话（supplement-chat）：体检指标+训练上下文→循证剂量建议；
 *   4) 体检指标解析（health-parse）：报告文字/照片→结构化指标，阅后即焚不落库。
 *
 * 风格沿用仓库惯例：小函数、决策写在注释里、不引新依赖（原生 fetch）。
 */

/* ---------- 周期护栏（rule-based，LLM 输出必须过这一关） ---------- */

export const GUARDRAILS = Object.freeze({
  // 单周期单动作加重上限：≤5% 且 ≤2.5kg。上肢小肌群再激进也翻不出这个圈。
  maxIncreasePct: 0.05,
  maxIncreaseKg: 2.5,
  // 连续两个周期被判定 reduce → 建议换动作而不是继续减
  consecutiveFailLimit: 2,
  deloadPct: 0.1
});

/** 校正一次加重提案。返回修正后的目标重量与被触发护栏的说明；合规时 override 为 null。 */
export function capIncrease(currentKg, proposedKg) {
  const delta = proposedKg - currentKg;
  if (delta <= 0) return { nextKg: proposedKg, override: null };
  const maxKg = Math.min(GUARDRAILS.maxIncreaseKg, currentKg * GUARDRAILS.maxIncreasePct);
  if (delta <= maxKg + 1e-9) return { nextKg: proposedKg, override: null };
  const capped = Math.round((currentKg + maxKg) * 4) / 4;
  return {
    nextKg: capped,
    override: `单周期加重上限：≤ ${GUARDRAILS.maxIncreasePct * 100}% 且 ≤ ${GUARDRAILS.maxIncreaseKg}kg`
  };
}

/** Epley 1RM（Coach 体系里已有 e1RM，这里给护栏与补剂上下文用的独立实现，避免耦合）。 */
export function estimate1RM(weightKg, reps) {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

/* ---------- 循证补剂基础盘（规则层，LLM 只做个性化解释，不得越过） ---------- */

export function ruleBasedSupplements({ weightKg = 64, goal = 'maintain', metrics = [] } = {}) {
  const items = [];
  const warnings = [];
  const flag = (key) => metrics.find((m) => m.key === key)?.flag;
  const kidneyBad = ['high', 'critical'].includes(flag('kidney_egfr')) ||
    ['high', 'critical'].includes(flag('kidney_creatinine'));
  const bpBad = ['high', 'critical'].includes(flag('blood_pressure_high'));
  const vitDLow = ['low', 'critical'].includes(flag('vitamin_d'));
  const uricHigh = ['high', 'critical'].includes(flag('uric_acid'));

  if (!kidneyBad) {
    items.push({ name: '肌酸一水合物', dosage: '5g/天', timing: '训练日练后随餐，休息日任意', reason: 'Tier 1 循证：力量与瘦体重，无需冲击期' });
  } else {
    warnings.push('肾功能指标异常：肌酸与高蛋白摄入需医生确认，未纳入推荐');
  }
  const protein = weightKg
    ? `每日总量补足至 ${Math.round(weightKg * 1.6)}-${Math.round(weightKg * 2.2)}g 蛋白`
    : '每日总量补足至 1.6-2.2g/kg 体重';
  items.push({ name: '蛋白粉', dosage: protein, timing: '练后或早餐蛋白缺口', reason: 'Tier 1：训练人群蛋白需求' });
  if (!bpBad) {
    items.push({ name: '咖啡因', dosage: '3-6mg/kg（约 200-400mg）', timing: '练前 60 分钟，14:00 后避免', reason: 'Tier 1：表现；血压偏高者不推' });
  } else {
    warnings.push('血压偏高：咖啡因未纳入推荐');
  }
  if (vitDLow) {
    items.push({ name: '维生素 D3', dosage: '2000IU/天', timing: '随含脂肪的正餐', reason: '体检 25(OH)D 偏低' });
  }
  items.push({ name: '鱼油 EPA+DHA', dosage: '1-3g/天（合计）', timing: '随餐', reason: 'Tier 2：心血管与恢复支持' });
  items.push({ name: '镁（甘氨酸镁）', dosage: '200-400mg/天', timing: '睡前', reason: 'Tier 2：睡眠与神经恢复' });
  if (goal === 'cut') {
    items.push({ name: '电解质', dosage: '出汗多训练日 1 份', timing: '练中/练后', reason: '热量缺口期大量出汗补钠钾' });
  }
  if (uricHigh) warnings.push('尿酸偏高：蛋白粉选乳清适量，肌酸使用前建议咨询医生');
  return { items, warnings };
}

export const SUPPLEMENT_DISCLAIMER =
  '本方案基于公开运动营养学证据与您主动提供的资料生成，仅供健康成年人参考，不构成医疗建议；如有疾病或用药请遵医嘱。';

/* ---------- 体检指标解析的参考范围（health-parse 用） ---------- */

export const HEALTH_RANGES = Object.freeze({
  kidney_egfr: { label: '肾功能 eGFR', unit: 'mL/min', low: 90, high: 120 },
  kidney_creatinine: { label: '肌酐', unit: 'μmol/L', low: 57, high: 97 },
  liver_alt: { label: '谷丙转氨酶 ALT', unit: 'U/L', low: 9, high: 50 },
  uric_acid: { label: '尿酸', unit: 'μmol/L', low: 208, high: 428 },
  blood_pressure_high: { label: '收缩压', unit: 'mmHg', low: 90, high: 139 },
  vitamin_d: { label: '25(OH)D / 维生素D', unit: 'ng/mL', low: 30, high: 100 },
  hemoglobin: { label: '血红蛋白', unit: 'g/L', low: 130, high: 175 },
  blood_lipids: { label: '总胆固醇', unit: 'mmol/L', low: 2.8, high: 5.2 }
});

/** 按参考范围给指标定级（解析结果的兜底校验，LLM 判错时以这里为准）。 */
export function classifyMetric(key, value) {
  const r = HEALTH_RANGES[key];
  if (!r) return 'normal';
  if (value < r.low) return 'low';
  if (value > r.high * 1.3) return 'critical';
  if (value > r.high) return 'high';
  return 'normal';
}

/* ---------- 统一的 JSON 剥壳（各家模型都爱裹 ``` 围栏） ---------- */

export function safeParseJson(text) {
  const stripped = String(text).trim().replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(stripped);
}
