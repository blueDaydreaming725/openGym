/**
 * 动作库（seed 数据）
 * 训练前从动作库选动作、中途替换（同肌群候选）都从这里取。
 * cues = 动作要点，训练中在聚焦卡片上逐条展示。
 */
import type { Exercise } from '../types/models'

export const EXERCISE_LIBRARY: Exercise[] = [
  // ── 胸 ──
  {
    id: 'ex-bench-press', name: '杠铃卧推', muscleGroup: '胸', equipment: '杠铃',
    description: '上背收紧贴凳，杠铃下放至乳头上沿，肘部约 45°',
    cues: ['肩胛骨后缩下沉，挺胸架稳', '握距略宽于肩', '杠铃轨迹：下至胸口上沿，推起至肩正上方', '双脚踩实地面，臀部不离开凳面'],
    defaultRestSeconds: 150, stepKg: 2.5,
  },
  {
    id: 'ex-incline-db-press', name: '上斜哑铃推', muscleGroup: '胸', equipment: '哑铃',
    description: '凳调至 30°，哑铃轨迹呈微弧线',
    cues: ['凳角 30° 左右，太高变成推肩', '小臂始终垂直地面', '下放大臂略低于躯干平面'],
    defaultRestSeconds: 120, stepKg: 2.5,
  },
  {
    id: 'ex-db-fly', name: '哑铃飞鸟', muscleGroup: '胸', equipment: '哑铃',
    description: '肘部微屈固定，感受胸肌拉伸与挤压',
    cues: ['手臂弯曲角度全程不变', '下放至有拉伸感即可，不要过深', '顶峰位主动挤压 1 秒'],
    defaultRestSeconds: 90, stepKg: 1,
  },
  {
    id: 'ex-cable-crossover', name: '绳索夹胸', muscleGroup: '胸', equipment: '绳索',
    description: '孤立动作，全程保持张力',
    cues: ['身体微前倾固定', '想象肘部画弧线合拢', '交叉位挤压 1 秒'],
    defaultRestSeconds: 90, stepKg: 2.5,
  },
  {
    id: 'ex-push-up', name: '俯卧撑', muscleGroup: '胸', equipment: '自重',
    description: '基础自重推类动作',
    cues: ['躯干成一条直线，不塌腰', '手肘与躯干约 45°', '下放至胸口接近地面'],
    defaultRestSeconds: 75, stepKg: 0,
  },
  // ── 背 ──
  {
    id: 'ex-deadlift', name: '硬拉', muscleGroup: '背', equipment: '杠铃',
    description: '髋铰链动作之王，全程脊柱中立',
    cues: ['杠铃贴小腿启动', '背阔肌收紧「藏腋下」', '髋膝同时伸展锁死，不后仰', '呼吸：拉前吸气绷紧，锁死换气'],
    defaultRestSeconds: 180, stepKg: 5,
  },
  {
    id: 'ex-pull-up', name: '引体向上', muscleGroup: '背', equipment: '自重',
    description: '背阔肌为主的自重拉类动作',
    cues: ['启动前沉肩，不要耸肩', '想象肘部往口袋方向拉', '下巴过杠即可，不必过度'],
    defaultRestSeconds: 120, stepKg: 2.5,
  },
  {
    id: 'ex-barbell-row', name: '杠铃划船', muscleGroup: '背', equipment: '杠铃',
    description: '躯干前倾约 45°，向腹部方向拉',
    cues: ['髋部后坐，背部平直', '杠铃拉向下腹部而非胸口', '顶峰位肩胛骨收紧 1 秒'],
    defaultRestSeconds: 150, stepKg: 2.5,
  },
  {
    id: 'ex-lat-pulldown', name: '高位下拉', muscleGroup: '背', equipment: '绳索',
    description: '引体替代/补充，重量好调节',
    cues: ['胸挺起，杆拉至锁骨', '肘部垂直向下压', '还原时控制速度，不完全卸力'],
    defaultRestSeconds: 90, stepKg: 2.5,
  },
  {
    id: 'ex-seated-row', name: '坐姿划船', muscleGroup: '背', equipment: '绳索',
    description: '中背厚度动作',
    cues: ['躯干稳定不前后晃', '拉至腹部，肩胛后缩', '还原慢放，感受拉伸'],
    defaultRestSeconds: 90, stepKg: 2.5,
  },
  {
    id: 'ex-face-pull', name: '面拉', muscleGroup: '背', equipment: '绳索',
    description: '肩后束与上背健康动作',
    cues: ['绳索拉向额头', '末端外旋（拳心朝后）', '全程轻重量、高次数'],
    defaultRestSeconds: 75, stepKg: 2.5,
  },
  // ── 腿 ──
  {
    id: 'ex-squat', name: '杠铃深蹲', muscleGroup: '腿', equipment: '杠铃',
    description: '下蹲至髋低于膝（或个人活动度极限），全程核心绷紧',
    cues: ['出杠三步走稳，深吸气压紧核心', '膝盖与脚尖同向，可微过脚尖', '下蹲髋膝同时折叠，不先撅臀', '起立时「蹬地面」而不是「抬屁股」'],
    defaultRestSeconds: 180, stepKg: 5,
  },
  {
    id: 'ex-rdl', name: '罗马尼亚硬拉', muscleGroup: '腿', equipment: '杠铃',
    description: '腘绳肌为主的髋铰链动作',
    cues: ['膝微屈固定，髋向后推', '杠铃贴大腿滑下', '拉伸感到即止，不追求杠铃触地'],
    defaultRestSeconds: 150, stepKg: 5,
  },
  {
    id: 'ex-leg-press', name: '腿举', muscleGroup: '腿', equipment: '器械',
    description: '股四头肌为主，腰背压力小于深蹲',
    cues: ['臀部贴紧靠背不拱起', '下放至 90° 或略深', '不锁膝，保持张力'],
    defaultRestSeconds: 120, stepKg: 10,
  },
  {
    id: 'ex-leg-curl', name: '腿弯举', muscleGroup: '腿', equipment: '器械',
    description: '腘绳肌孤立动作',
    cues: ['髋部压紧垫面', '顶峰位停顿 1 秒', '还原控制 2 秒'],
    defaultRestSeconds: 75, stepKg: 5,
  },
  {
    id: 'ex-calf-raise', name: '提踵', muscleGroup: '腿', equipment: '器械',
    description: '小腿训练，注意全程幅度',
    cues: ['最低位充分拉伸停 1 秒', '最高位踮到极限', '次数可以偏高（12-20）'],
    defaultRestSeconds: 60, stepKg: 5,
  },
  {
    id: 'ex-lunge', name: '箭步蹲', muscleGroup: '腿', equipment: '哑铃',
    description: '单边腿部动作，附带平衡训练',
    cues: ['步幅适中，前膝不过度前移', '躯干竖直下沉', '后膝接近地面但不砸地'],
    defaultRestSeconds: 90, stepKg: 2.5,
  },
  // ── 肩 ──
  {
    id: 'ex-ohp', name: '杠铃推举', muscleGroup: '肩', equipment: '杠铃',
    description: '站姿实力举，核心全程绷紧',
    cues: ['杠铃架在锁骨，手腕中立', '推起时头后移让位，过头回正', '臀部腹部收紧，不挺腰'],
    defaultRestSeconds: 150, stepKg: 2.5,
  },
  {
    id: 'ex-lateral-raise', name: '哑铃侧平举', muscleGroup: '肩', equipment: '哑铃',
    description: '中束孤立动作，轻重量高次数',
    cues: ['肘部微屈，想象抬肘不抬手', '抬至与肩同高或略低', '不借力甩动，慢放'],
    defaultRestSeconds: 60, stepKg: 1,
  },
  {
    id: 'ex-rear-delt-fly', name: '俯身飞鸟', muscleGroup: '肩', equipment: '哑铃',
    description: '后束孤立动作',
    cues: ['俯身至躯干接近水平', '肘部微屈固定，向两侧打开', '想象小拇指发力引导'],
    defaultRestSeconds: 60, stepKg: 1,
  },
  // ── 手臂 ──
  {
    id: 'ex-barbell-curl', name: '杠铃弯举', muscleGroup: '手臂', equipment: '杠铃',
    description: '二头肌基础动作',
    cues: ['肘部固定在躯干两侧', '不后仰借力', '顶峰挤压，慢放 2 秒'],
    defaultRestSeconds: 75, stepKg: 2.5,
  },
  {
    id: 'ex-hammer-curl', name: '锤式弯举', muscleGroup: '手臂', equipment: '哑铃',
    description: '肱肌与前臂参与更多',
    cues: ['拳心相对全程不变', '肘部不前后移动', '可交替或同时'],
    defaultRestSeconds: 75, stepKg: 1,
  },
  {
    id: 'ex-tricep-pushdown', name: '绳索下压', muscleGroup: '手臂', equipment: '绳索',
    description: '三头肌孤立动作',
    cues: ['大臂夹紧躯干固定', '下压至完全伸展', '肘部不前后漂移'],
    defaultRestSeconds: 75, stepKg: 2.5,
  },
  {
    id: 'ex-overhead-ext', name: '过头臂屈伸', muscleGroup: '手臂', equipment: '哑铃',
    description: '三头长束在拉伸位训练',
    cues: ['大臂贴近耳朵固定', '下放至充分拉伸', '重量宁轻勿重'],
    defaultRestSeconds: 75, stepKg: 1,
  },
  // ── 核心 ──
  {
    id: 'ex-plank', name: '平板支撑', muscleGroup: '核心', equipment: '自重',
    description: '静态核心稳定动作',
    cues: ['肘在肩正下方', '夹臀收腹，骨盆后倾', '不塌腰不撅臀'],
    defaultRestSeconds: 60, stepKg: 0,
  },
  {
    id: 'ex-hanging-leg-raise', name: '悬垂举腿', muscleGroup: '核心', equipment: '自重',
    description: '下腹为主的悬挂动作',
    cues: ['骨盆后倾启动，不是单纯抬腿', '控制下放不荡腿', '力量不足可先屈膝'],
    defaultRestSeconds: 75, stepKg: 0,
  },
  // ── 有氧 ──
  {
    id: 'ex-treadmill-walk', name: '跑步机快走（坡度）', muscleGroup: '有氧', equipment: '器械',
    description: 'LISS 有氧主力：坡度 8-12%、速度 5-6km/h',
    cues: ['心率维持在最大心率 60-70%', '不扶扶手', '全程能正常说话的强度'],
    defaultRestSeconds: 0, stepKg: 0,
  },
  {
    id: 'ex-cycling', name: '动感单车 / 功率车', muscleGroup: '有氧', equipment: '器械',
    description: '低冲击有氧，膝盖友好',
    cues: ['座椅高度：踏至最低腿微屈', '阻力调到能保持 80+ rpm', '中等强度持续 30-45 分钟'],
    defaultRestSeconds: 0, stepKg: 0,
  },
  {
    id: 'ex-rowing', name: '划船机', muscleGroup: '有氧', equipment: '器械',
    description: '全身性有氧，含拉类训练成分',
    cues: ['发力顺序：蹬腿→后倾→拉臂', '还原顺序相反：伸臂→复位→屈膝', '桨频控制在 24-28 spm'],
    defaultRestSeconds: 0, stepKg: 0,
  },
  // ── Winston 常用器械动作（来自 Claw 计划，2026-09-12）──
  {
    id: 'ex-pec-deck', name: '蝴蝶机夹胸', muscleGroup: '胸', equipment: '器械',
    description: '固定轨迹的胸部孤立动作',
    cues: ['手肘微屈固定角度', '合拢位挤压 1 秒', '还原慢放不卸力'],
    defaultRestSeconds: 90, stepKg: 2.5,
  },
  {
    id: 'ex-incline-bb-press', name: '上斜杠铃卧推', muscleGroup: '胸', equipment: '杠铃',
    description: '30° 上斜，重点上胸',
    cues: ['凳角 30°，杠铃落在锁骨附近', '小臂垂直地面', '起桥幅度小于平推'],
    defaultRestSeconds: 150, stepKg: 2.5,
  },
  {
    id: 'ex-db-shoulder-press', name: '哑铃推肩', muscleGroup: '肩', equipment: '哑铃',
    description: '坐姿哑铃肩推',
    cues: ['手腕中立不后折', '下放至大臂略低于水平', '推起不锁死肘关节'],
    defaultRestSeconds: 90, stepKg: 1.25,
  },
  {
    id: 'ex-assisted-pullup', name: '插片式辅助引体', muscleGroup: '背', equipment: '器械',
    description: '辅助重量的引体，辅助越小越难',
    cues: ['辅助配重只是脚手架：目标 RPE≤8', '沉肩启动，肘往口袋拉', '下巴过杠，控制下放'],
    defaultRestSeconds: 150, stepKg: 2.5,
  },
  {
    id: 'ex-t-bar-row', name: 'T杆划船', muscleGroup: '背', equipment: '器械',
    description: '中背厚度主项之一',
    cues: ['躯干固定不起伏', '拉向腹部，肩胛后缩', '顶峰停顿，慢放'],
    defaultRestSeconds: 150, stepKg: 2.5,
  },
  {
    id: 'ex-reverse-pec-deck', name: '反向蝴蝶机', muscleGroup: '肩', equipment: '器械',
    description: '后束孤立，肩背健康动作',
    cues: ['轻重量高次数', '肘微屈向外打开', '想象小拇指引导'],
    defaultRestSeconds: 75, stepKg: 2.5,
  },
  {
    id: 'ex-leg-extension', name: '腿屈伸', muscleGroup: '腿', equipment: '器械',
    description: '股四头肌孤立动作',
    cues: ['背贴靠垫不借力', '顶峰收紧 1 秒', '还原控制 2 秒'],
    defaultRestSeconds: 90, stepKg: 5,
  },
  {
    id: 'ex-hip-adduction', name: '腿内收', muscleGroup: '腿', equipment: '器械',
    description: '内收肌群孤立动作',
    cues: ['动作幅度全程可控', '顶峰停顿 1 秒', '还原不完全卸力'],
    defaultRestSeconds: 75, stepKg: 5,
  },
  {
    id: 'ex-glute-machine', name: '臀腿机', muscleGroup: '腿', equipment: '器械',
    description: '臀/后侧链补充动作',
    cues: ['腰部中立不代偿', '顶峰挤压臀部', '双侧交替或同时按器械设计'],
    defaultRestSeconds: 75, stepKg: 5,
  },
  {
    id: 'ex-crunch', name: '卷腹', muscleGroup: '核心', equipment: '自重',
    description: '腹直肌上部训练',
    cues: ['下背贴地，卷起肩胛即可', '呼气卷起，吸气还原', '不抱头借力'],
    defaultRestSeconds: 60, stepKg: 0,
  },
  {
    id: 'ex-dead-bug', name: '死虫', muscleGroup: '核心', equipment: '自重',
    description: '抗伸展核心稳定动作',
    cues: ['下背全程压地', '对侧手脚同时缓慢伸展', '宁慢勿快'],
    defaultRestSeconds: 60, stepKg: 0,
  },
  {
    id: 'ex-hanging-knee-raise', name: '悬垂举膝', muscleGroup: '核心', equipment: '自重',
    description: '下腹为主的悬挂动作（屈膝版）',
    cues: ['骨盆后倾带动膝盖', '不荡腿借力', '下放控制'],
    defaultRestSeconds: 75, stepKg: 0,
  },
]

/** 按 id 查动作 */
export function getExercise(id: string): Exercise | undefined {
  return EXERCISE_LIBRARY.find(e => e.id === id)
}

/** 全部动作库（训练准备页/进行页添加动作用） */
export function allExercises(): Exercise[] {
  return EXERCISE_LIBRARY
}

/** 找替换候选：同肌群、排除自身，器械不同优先（器械被占场景） */
export function findAlternatives(exerciseId: string): Exercise[] {
  const current = getExercise(exerciseId)
  if (!current) return []
  return EXERCISE_LIBRARY.filter(
    e => e.muscleGroup === current.muscleGroup && e.id !== exerciseId,
  )
}
