/**
 * 周期工具：当前周期判定与到期判断
 * 周期两种形态：日期制（endDate）与次数制（无 endDate，练满 workouts.length 视为一轮）
 */

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 距周期截止的剩余天数（无截止日期返回 null） */
export function daysUntilEnd(endDate?: string): number | null {
  if (!endDate) return null
  const diff = Math.round(
    (new Date(endDate + 'T23:59:59').getTime() - Date.now()) / 86400000,
  )
  return diff
}

/** 周期是否已到期（endDate 已过，或次数制已练满整数轮） */
export function isCycleDue(
  cycle: { endDate?: string; workouts: unknown[] },
  doneCount: number,
): boolean {
  if (cycle.endDate) return todayStr() > cycle.endDate
  const total = cycle.workouts.length
  return total > 0 && doneCount > 0 && doneCount % total === 0
}

/** 当前应执行的周期：最后一个未到截止日的；都到期则取最后一个 */
export function getActiveCycle<T extends { endDate?: string }>(cycles: T[]): T {
  const today = todayStr()
  const active = cycles.find(c => !c.endDate || c.endDate >= today)
  return active ?? cycles[cycles.length - 1]
}

/** 距截止的天数描述 */
export function endLabel(endDate?: string): string | null {
  if (!endDate) return null
  const d = daysUntilEnd(endDate)
  if (d == null) return null
  if (d < 0) return `已到期（${endDate.slice(5)}）`
  if (d === 0) return `今天截止（${endDate.slice(5)}）`
  return `还剩 ${d} 天（至 ${endDate.slice(5)}）`
}
