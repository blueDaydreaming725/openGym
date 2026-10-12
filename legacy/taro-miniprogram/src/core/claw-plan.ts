/**
 * Claw 计划导入：把用户在 OpenClaw 里维护的真实计划迁移进 app（2026-09-12 导出件）
 * 数据来源：用户提供的 A（计划）/B（状态与记录）类导出，逐字对齐，未做"优化"。
 * C 类知识等 tar 包到位后走 knowledge 导入。
 */
import type { KnowledgeEntry, SessionRecord, TrainingPlan } from '../types/models'
import { genId } from './plan-templates'

export const CLAW_PLAN_NAME = '形体期 PPL（减脂塑形专项）'

/** 构建形体期 PPL 计划（推/拉/腿，练三休一，滚动轮转） */
export function buildClawPlan(): TrainingPlan {
  const cycle = {
    id: genId('cyc'),
    planId: '',
    name: '减脂塑形专项（至 9/24）',
    order: 1,
    durationWeeks: 1,
    endDate: '2026-09-24',
    workouts: [
      {
        id: genId('wo'),
        name: '推日（胸肩三头）',
        items: [
          { exerciseId: 'ex-bench-press', sets: 4, repRangeMin: 6, repRangeMax: 10, targetWeightKg: 50, restSeconds: 150 },
          { exerciseId: 'ex-incline-bb-press', sets: 3, repRangeMin: 8, repRangeMax: 10, targetWeightKg: 40, restSeconds: 150 },
          { exerciseId: 'ex-pec-deck', sets: 3, repRangeMin: 10, repRangeMax: 12, targetWeightKg: 40, restSeconds: 90 },
          { exerciseId: 'ex-db-shoulder-press', sets: 3, repRangeMin: 10, repRangeMax: 12, targetWeightKg: 12.5, restSeconds: 90 },
          { exerciseId: 'ex-tricep-pushdown', sets: 3, repRangeMin: 10, repRangeMax: 12, targetWeightKg: 15, restSeconds: 75 },
          { exerciseId: 'ex-crunch', sets: 2, repRangeMin: 12, repRangeMax: 20, restSeconds: 60 },
        ],
      },
      {
        id: genId('wo'),
        name: '拉日（背二头）',
        items: [
          { exerciseId: 'ex-assisted-pullup', sets: 3, repRangeMin: 6, repRangeMax: 10, targetWeightKg: 15, restSeconds: 150 },
          { exerciseId: 'ex-t-bar-row', sets: 3, repRangeMin: 8, repRangeMax: 12, targetWeightKg: 30, restSeconds: 150 },
          { exerciseId: 'ex-lat-pulldown', sets: 2, repRangeMin: 10, repRangeMax: 12, targetWeightKg: 45, restSeconds: 90 },
          { exerciseId: 'ex-reverse-pec-deck', sets: 2, repRangeMin: 15, repRangeMax: 20, targetWeightKg: 15, restSeconds: 75 },
          { exerciseId: 'ex-barbell-curl', sets: 2, repRangeMin: 8, repRangeMax: 12, targetWeightKg: 15, restSeconds: 75 },
          { exerciseId: 'ex-hammer-curl', sets: 2, repRangeMin: 10, repRangeMax: 12, targetWeightKg: 10, restSeconds: 75 },
        ],
      },
      {
        id: genId('wo'),
        name: '腿日',
        items: [
          { exerciseId: 'ex-squat', sets: 4, repRangeMin: 6, repRangeMax: 8, targetWeightKg: 60, restSeconds: 180 },
          { exerciseId: 'ex-leg-extension', sets: 4, repRangeMin: 8, repRangeMax: 12, targetWeightKg: 55, restSeconds: 90 },
          { exerciseId: 'ex-hip-adduction', sets: 3, repRangeMin: 8, repRangeMax: 12, targetWeightKg: 60, restSeconds: 75 },
          { exerciseId: 'ex-glute-machine', sets: 2, repRangeMin: 8, repRangeMax: 12, targetWeightKg: 60, restSeconds: 75 },
          { exerciseId: 'ex-calf-raise', sets: 3, repRangeMin: 12, repRangeMax: 15, targetWeightKg: 40, restSeconds: 60 },
        ],
      },
    ],
  }

  const travelCycle = {
    id: genId('cyc'),
    planId: '',
    name: '旅行维持期（9/24-10/4）',
    order: 2,
    durationWeeks: 2,
    endDate: '2026-10-04',
    workouts: [
      {
        id: genId('wo'),
        name: '维持 · 上肢推拉',
        items: [
          { exerciseId: 'ex-push-up', sets: 3, repRangeMin: 10, repRangeMax: 15, restSeconds: 75 },
          { exerciseId: 'ex-pull-up', sets: 3, repRangeMin: 5, repRangeMax: 8, restSeconds: 120 },
          { exerciseId: 'ex-lateral-raise', sets: 2, repRangeMin: 12, repRangeMax: 15, targetWeightKg: 6, restSeconds: 60 },
        ],
      },
      {
        id: genId('wo'),
        name: '维持 · 下肢核心',
        items: [
          { exerciseId: 'ex-lunge', sets: 3, repRangeMin: 10, repRangeMax: 12, restSeconds: 90 },
          { exerciseId: 'ex-plank', sets: 3, repRangeMin: 40, repRangeMax: 60, restSeconds: 60 },
          { exerciseId: 'ex-crunch', sets: 2, repRangeMin: 15, repRangeMax: 20, restSeconds: 60 },
        ],
      },
      {
        id: genId('wo'),
        name: '旅行 · 步行活动',
        items: [{ exerciseId: 'ex-treadmill-walk', sets: 1, repRangeMin: 30, repRangeMax: 45, restSeconds: 0 }],
      },
    ],
  }

  return {
    id: genId('plan'),
    name: CLAW_PLAN_NAME,
    type: 'split',
    splitKind: 3,
    trainDaysPerCycle: 3,
    restDaysPerCycle: 1,
    restDays: [],
    cycles: [cycle, travelCycle],
    note: [
      '来源：OpenClaw 计划（2026-09-12 导出），逐字迁移。',
      '减脂塑形专项至 9/24 旅行前；旅行期（9/24-10/4）以维持为主；回来后转 3 个月增力计划。',
      '力竭双标：大重量复合不力竭（RPE 8）；轻重孤立可力竭。',
      '组间歇：复合 6 次组 2-3 分钟；孤立 12 次组 30 秒-1.5 分钟。',
      '单次正式组常规满负荷 16 组，轻松时 18 组。',
      '进阶门槛（全满足才加）：次数顶端达成且 RPE≤8 / 技术稳定 / 组间歇拉满。',
      '核心：训练后 2-3 组（卷腹/悬垂举膝/死虫/平板轮换），每周 3 次；KGE 每日 2 轮起。',
      '减脂参数：缺口 300-500kcal，周均降 0.3-0.5kg，蛋白 125-140g/天，脂肪 ≥45-50g/天。',
      '卧推策略：50kg 稳技术不急加片，两周摸清水平再评估。',
      '新动作约每月 1 个，渐进加入；无教练不自学高风险动作。',
    ].join('\n'),
  }
}

/** 三次历史训练（9/9 推、9/10 拉、9/11 腿），逐字迁移；planId/cycleId 在导入时回填 */
export function buildClawHistory(planId: string, cycleId: string): SessionRecord[] {
  const mk = (
    id: string, date: string,
    items: Array<{ exerciseId: string; sets: Array<[number, number, number?]> }>,
    note: string,
  ): SessionRecord => ({
    id: `claw_${id}`,
    planId,
    cycleId,
    date,
    status: 'completed',
    startedAt: `${date}T19:00:00+08:00`,
    endedAt: `${date}T20:10:00+08:00`,
    durationMinutes: 70,
    exercises: items.map(it => ({
      exerciseId: it.exerciseId,
      plannedSets: it.sets.length,
      sets: it.sets.map(([weightKg, reps, rpe], i) => ({
        setNo: i + 1, weightKg, reps, ...(rpe != null ? { rpe } : {}),
      })),
    })),
    note,
  })

  return [
    mk('push-0909', '2026-09-09', [
      { exerciseId: 'ex-bench-press', sets: [[50, 8, 8], [50, 8, 8], [50, 8, 8], [45, 10, 8]] },
      { exerciseId: 'ex-incline-bb-press', sets: [[40, 7, 8], [40, 8, 8], [40, 8, 8]] },
      { exerciseId: 'ex-pec-deck', sets: [[40, 10], [40, 10], [40, 10]] },
      { exerciseId: 'ex-db-shoulder-press', sets: [[12.5, 12], [12.5, 12]] },
      { exerciseId: 'ex-tricep-pushdown', sets: [[15, 10], [15, 10], [15, 8]] },
    ], '卧推维持 50kg×8×3 且 RPE8，技术与组间休息稳定后再评估；上斜由器械改为杠铃。KGE 完成 2 轮。'),
    mk('pull-0910', '2026-09-10', [
      { exerciseId: 'ex-assisted-pullup', sets: [[15, 9, 8.5], [15, 9, 8.5], [15, 9, 8.5]] },
      { exerciseId: 'ex-t-bar-row', sets: [[30, 8, 8.5], [30, 8, 8.5], [30, 8, 8.5]] },
      { exerciseId: 'ex-lat-pulldown', sets: [[45, 8], [45, 8], [45, 8]] },
      { exerciseId: 'ex-seated-row', sets: [[25, 8], [25, 8]] },
      { exerciseId: 'ex-barbell-curl', sets: [[15, 12], [15, 12], [15, 12]] },
    ], '引体次数与 RPE 持平，下次维持 15kg 辅助、先把 RPE 压到 8 以内；T杆 30kg 维持、争取 8-10 次；第二划船后续删减，空间给反向蝴蝶机与二头。KGE 完成 2 轮。'),
    mk('leg-0911', '2026-09-11', [
      { exerciseId: 'ex-squat', sets: [[60, 8], [60, 8], [60, 8], [60, 8]] },
      { exerciseId: 'ex-leg-extension', sets: [[55, 8], [55, 8], [55, 8], [55, 8]] },
      { exerciseId: 'ex-hip-adduction', sets: [[60, 8], [60, 8], [60, 8]] },
      { exerciseId: 'ex-glute-machine', sets: [[60, 8], [60, 8]] },
    ], 'RPE 未记录，按目标 RPE 8 控制。深蹲由 3 组加至 4 组；下次先记录 RPE 与膝腰状态，深蹲 ≤RPE8 且稳定则维持 60kg 争取 9 次。'),
  ]
}

/** C 类知识（导出件里已有的摘要部分；43 页 wiki 正文等 tar 包到位后另行导入） */
export function buildClawKnowledge(): KnowledgeEntry[] {
  const mk = (title: string, category: string, content: string, tags: string[]): KnowledgeEntry => ({
    id: `kb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    category,
    content,
    attachmentRefs: [],
    tags,
    uploadedAt: new Date().toISOString(),
  })

  return [
    mk('进阶规则（线性周期）', '训练', [
      '主项渐进：4×8 → 2×6 → 3×6 → 4×6 → 2×5…，全程 RPE 8。',
      '加重量门槛（全部满足才加）：① 目标次数顶端达成且 RPE ≤ 8；② 技术稳定（轨迹/呼吸/起桥/肩胛）；③ 组间歇已拉满，不靠缩短组间休息进步。',
      '否则维持重量，先打磨技术或加组。',
    ].join('\n'), ['进阶', '规则']),
    mk('训练法则（凯圣王×谭成义三分化）', '训练', [
      '复合 6-10 次 RPE 8 不力竭；孤立 8-15 次可力竭；5 大项偶尔加 3-5RM 增力组。',
      '组间歇按供能系统：5 次组 3-8 分钟；12 次组 30 秒-3 分钟。',
      '三分化推/拉/腿，练三休一，一周约两循环。',
    ].join('\n'), ['分化', '组间歇']),
    mk('减脂/营养（松松手册）', '饮食', [
      '热量缺口 10-20%（300-500kcal）；碳水 3-3.5g/kg 起，不低于 2g/kg；蛋白 1.5-2g/kg；脂肪 0.7-1g/kg 保底。',
      '训后餐占全天碳水 50%（高GI）+ 蛋白 30-50g + 脂肪 <20g；早饭 30%；训前 20%；其余餐尽量不吃碳水。',
      '配额试吃法：吃两周看体重，不掉则下调碳水 0.3-0.5g/kg。',
      '饮食 > 有氧；体重看两周趋势；不可极低脂、不可弃训后餐。',
    ].join('\n'), ['减脂', '营养']),
    mk('减脂塑形专项参数（2026-08-14 起）', '计划', [
      '热量缺口 300-500kcal/天，目标周均体重降 0.3-0.5kg；蛋白 125-140g/天、脂肪 ≥45-50g/天，其余碳水（训后餐占全天碳水约 50%）。',
      '训练时段固定：压缩无效等待，力量 + 10-20 分钟低强度有氧；步数 8000-10000。',
      '每周最多 1 次 10-15 分钟间歇有氧，腿日不做。晨起空腹称重每周 3-4 次看周均。',
      '连续两周未下降：优先减每日碳水 20-30g，不加训练时长。',
      '面部水肿/下颌线：避免高盐暴食与酒精，稳定饮水睡眠；旅行前不极端脱水，不极端节食。',
    ].join('\n'), ['减脂', '专项']),
  ]
}
