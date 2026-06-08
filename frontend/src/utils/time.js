/** All times in the app are displayed in Israel time (Asia/Jerusalem). */
const TZ = "Asia/Jerusalem"

/** "21:00" */
export function ilTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
}

/** "Jun 11 · 21:00" */
export function ilDateTime(iso) {
  const d = new Date(iso)
  const date = d.toLocaleDateString("en-GB", { timeZone: TZ, month: "short", day: "numeric" })
  const time = d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
  return `${date} · ${time}`
}

/** "Wed, Jun 11 · 21:00" */
export function ilDateTimeFull(iso) {
  const d = new Date(iso)
  return d.toLocaleString("en-GB", {
    timeZone: TZ,
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

/** YYYY-MM-DD in Israel timezone (for date-equality comparisons) */
export function ilDateKey(iso) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ })
}

/** Today's YYYY-MM-DD in Israel timezone */
export function ilTodayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ })
}

/** Human-readable day label: "Today", "Tomorrow", or "Wed, Jun 12" */
export function ilDayLabel(iso) {
  const key = ilDateKey(iso)
  const today = ilTodayKey()
  const tomorrow = ilDateKey(new Date(Date.now() + 86_400_000).toISOString())
  if (key === today)    return "Today"
  if (key === tomorrow) return "Tomorrow"
  const d = new Date(iso)
  return d.toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" })
}
