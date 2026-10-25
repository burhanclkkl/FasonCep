export function istanbulToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Istanbul', year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(now)
  const value = (type: string) => parts.find(p => p.type === type)!.value
  return `${value('year')}-${value('month')}-${value('day')}`
}
export function weekEnd(today: string): string {
  const day = new Date(`${today}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() + (7 - day.getUTCDay()) % 7)
  return day.toISOString().slice(0,10)
}
export function dueBucket(due: string, today: string): 'late' | 'today' | 'week' | 'later' {
  if (due < today) return 'late'
  if (due === today) return 'today'
  return due <= weekEnd(today) ? 'week' : 'later'
}
