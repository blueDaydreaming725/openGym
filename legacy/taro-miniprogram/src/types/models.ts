/**
 * 核心领域模型类型草案（v0）
 * 说明：仅保证类型可编译，字段命名与细节以明日对齐结论为准，届时统一调整。
 */

/** 星期（用于休息日安排等场景） */
export type WeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** 训练计划类型：分化训练 / 纯力量 / 减脂 */
export type TrainingPlanType = 'split' | 'strength' | 'fatloss'

/** 训练计划 */
export interface TrainingPlan {
  /** 计划唯一标识 */
  id: string
  /** 计划名称，如 "5 分化增肌计划" */
  name: string
  /** 计划类型 */
  type: TrainingPlanType
  /**
   * 分化方式（仅 type === 'split' 时有效）：
   * 2 - 上下肢分化；3 - 推拉腿；4 - 四分化；5 - 五分化
   */
  splitKind?: 2 | 3 | 4 | 5
  /** 每周期训练天数，如一周 4 练 */
  trainDaysPerCycle: number
  /** 每周期休息天数 */
  restDaysPerCycle: number
  /** 休息日安排（按星期，1 表示周一；空数组表示不固定，按训练节奏顺延） */
  restDays: WeekDay[]
  /** 计划包含的训练周期 */
  cycles: Cycle[]
  /** 备注 */
  note?: string
}

/** 训练周期（一个计划可包含多个周期，如"增肌期 / 冲刺期"） */
export interface Cycle {
  /** 周期唯一标识 */
  id: string
  /** 所属计划 */
  planId: string
  /** 周期名称 */
  name: string
  /** 周期序号（从 1 开始） */
  order: number
  /** 周期时长（周） */
  durationWeeks: number
  /** 周期截止日期（ISO 8601，如 2026-09-24）；日期制周期到期即触发复盘 */
  endDate?: string
  /** 周期内单次训练模板（动作安排） */
  workouts: Workout[]
}

/** 单次训练模板（周期内某一次训练的动作安排，区别于实际训练记录） */
export interface Workout {
  /** 模板标识 */
  id: string
  /** 该次训练名称，如 "胸 + 三头" */
  name: string
  /** 动作清单（按顺序执行） */
  items: WorkoutItem[]
}

/** 训练模板中的单个动作安排 */
export interface WorkoutItem {
  /** 引用的动作 */
  exerciseId: string
  /** 组数 */
  sets: number
  /** 每组目标次数区间下限 */
  repRangeMin?: number
  /** 每组目标次数区间上限 */
  repRangeMax?: number
  /** 目标重量（kg），可作参考值 */
  targetWeightKg?: number
  /** 组间休息（秒） */
  restSeconds?: number
}

/** 单个动作的单组记录 */
export interface SetRecord {
  /** 组序号（从 1 开始） */
  setNo: number
  /** 次数 */
  reps: number
  /** 重量（kg） */
  weightKg: number
  /** RPE（1~10，主观疲劳度） */
  rpe?: number
  /** 备注（如"最后一组力竭"） */
  note?: string
}

/** 训练会话状态：进行中（可退出恢复）/ 已完成 */
export type SessionStatus = 'in_progress' | 'completed'

/** 训练现场（实时持久化：来电/杀进程后精确恢复到中断那一刻） */
export interface SessionCursor {
  /** 当前聚焦的动作下标 */
  curIdx: number
  /** 当前组重量（kg） */
  curWeightKg: number
  /** 当前组次数（字符串，跟随输入框） */
  curReps: string
  /** 当前组已选 RPE（可空） */
  curRpe?: number
  /** 组间倒计时绝对截止时间（epoch ms）；无 = 不在休息 */
  restDeadline?: number
  /** 本次倒计时总时长（秒），用于进度条 */
  restTotal?: number
}

/**
 * 本次训练的动作条目（动作实例）
 * 与模板 WorkoutItem 不同：这是"本次训练"实际要做的动作，
 * 允许训练前替换（健身房器械被占）、训练中调整组次重量、增删动作。
 */
export interface SessionExerciseItem {
  /** 引用的动作 */
  exerciseId: string
  /** 计划组数（训练中可调整） */
  plannedSets: number
  /** 目标次数（训练中可调整；区间则两个都填） */
  targetRepMin?: number
  targetRepMax?: number
  /** 目标重量（kg），训练中可调整 */
  targetWeightKg?: number
  /** 组间休息（秒），完成后自动倒计时 */
  restSeconds?: number
  /** 若是中途从其他动作替换而来，记录原动作 id */
  replacedFromExerciseId?: string
  /** 是否跳过（器械被占且不想换，直接跳过该动作） */
  skipped?: boolean
  /** 各组完成记录 */
  sets: SetRecord[]
}

/** 单次训练记录（= 一次训练会话，支持中断恢复） */
export interface SessionRecord {
  /** 记录唯一标识 */
  id: string
  /** 所属计划 */
  planId: string
  /** 所属周期 */
  cycleId: string
  /** 本次训练日名称（如"推日（胸肩三头）"），用于日历等展示 */
  workoutName?: string
  /** 训练日期（ISO 8601，如 2026-09-11） */
  date: string
  /** 会话状态 */
  status: SessionStatus
  /** 训练开始时间（ISO 8601） */
  startedAt?: string
  /** 结束时间（ISO 8601） */
  endedAt?: string
  /** 训练时长（分钟） */
  durationMinutes?: number
  /** 本次训练动作清单（实例，可中途调整） */
  exercises: SessionExerciseItem[]
  /** 训练现场快照（实时写盘，用于中断恢复） */
  cursor?: SessionCursor
  /** AI/系统一句话点评 */
  comment?: string
  /** 主观感受（如"状态好 / 一般 / 疲惫"） */
  feeling?: string
  /** 备注 */
  note?: string
}

/** 动作（训练动作库） */
export interface Exercise {
  /** 动作唯一标识 */
  id: string
  /** 动作名称，如 "杠铃卧推" */
  name: string
  /** 目标肌群，如 "胸" */
  muscleGroup: string
  /** 所需器械，如 "杠铃 / 绳索 / 自重" */
  equipment?: string
  /** 动作要领说明 */
  description?: string
  /** 动作要点（逐条提示，训练中展示） */
  cues?: string[]
  /** 默认组间休息（秒），无则用全局默认 90s */
  defaultRestSeconds?: number
  /** 常用加重步长（kg），如杠铃 2.5、哑铃 1 */
  stepKg?: number
}

/** 单个动作的重量目标 */
export interface ExerciseWeightGoal {
  /** 引用的动作 */
  exerciseId: string
  /** 目标重量（kg） */
  targetWeightKg: number
  /** 达成期限（ISO 8601 日期），可空 */
  deadline?: string
}

/** 目标（体重 / 时长 / 动作重量） */
export interface Goal {
  /** 目标唯一标识 */
  id: string
  /** 目标名称 */
  name: string
  /** 体重目标（kg），可空表示不设体重目标 */
  weightTargetKg?: number
  /** 时长目标（分钟，如每周训练总时长） */
  durationTargetMinutes?: number
  /** 各动作的重量目标 */
  exerciseWeightGoals: ExerciseWeightGoal[]
  /** 创建时间（ISO 8601） */
  createdAt: string
}

/** 餐次类型 */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** 饮食记录中的单个食物条目 */
export interface FoodItem {
  /** 食物名称 */
  name: string
  /** 份量描述，如 "一碗 / 200g" */
  portion?: string
  /** 该份食物热量（千卡） */
  calories: number
}

/** 饮食记录 */
export interface DietRecord {
  /** 记录唯一标识 */
  id: string
  /** 记录日期（ISO 8601） */
  date: string
  /** 餐次 */
  mealType: MealType
  /** 食物清单 */
  foods: FoodItem[]
  /** 该餐总卡路里（千卡） */
  totalCalories: number
  /** 拍照引用（本地临时文件路径或上传后的 fileId），可多张 */
  photoRefs: string[]
  /** AI 一句话点评（合理性分析） */
  comment?: string
  /** 备注 */
  note?: string
}

/** 补剂计划中的单个补剂条目 */
export interface SupplementItem {
  /** 补剂名称，如 "乳清蛋白 / 肌酸" */
  name: string
  /** 每次剂量，如 "30g / 5g" */
  dosage: string
  /** 服用时机，如 "训练后 / 早餐随餐 / 睡前" */
  timing: string
  /** 每日次数 */
  timesPerDay: number
}

/** 补剂计划 */
export interface SupplementPlan {
  /** 计划唯一标识 */
  id: string
  /** 计划名称 */
  name: string
  /** 补剂清单 */
  items: SupplementItem[]
  /** 生效起始日期（ISO 8601） */
  startDate?: string
  /** 生效结束日期（ISO 8601），空表示长期有效 */
  endDate?: string
  /** 备注 */
  note?: string
}

/** 健康报告（由体重 / 体脂 / 饮食等数据生成的周期性报告） */
export interface HealthReport {
  /** 报告唯一标识 */
  id: string
  /** 报告生成日期（ISO 8601） */
  generatedAt: string
  /** 报告覆盖周期开始（ISO 8601） */
  periodStart: string
  /** 报告覆盖周期结束（ISO 8601） */
  periodEnd: string
  /** 平均体重（kg） */
  avgWeightKg?: number
  /** 体脂率（%），可空 */
  bodyFatPercent?: number
  /** 周期内总训练次数 */
  sessionCount?: number
  /** 日均摄入热量（千卡） */
  avgDailyCalories?: number
  /** 综合结论与建议 */
  summary?: string
}

/** 知识库条目（上传 / 下载 / 管理） */
export interface KnowledgeEntry {
  /** 条目唯一标识 */
  id: string
  /** 标题 */
  title: string
  /** 分类，如 "训练 / 饮食 / 恢复" */
  category: string
  /** 正文内容或摘要 */
  content: string
  /** 附件引用（文件 fileId 或 URL），可多个 */
  attachmentRefs: string[]
  /** 上传者 */
  uploader?: string
  /** 上传时间（ISO 8601） */
  uploadedAt?: string
  /** 下载次数 */
  downloadCount?: number
  /** 标签，便于检索 */
  tags?: string[]
}
