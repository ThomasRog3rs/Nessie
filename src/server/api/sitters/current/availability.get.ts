// Mocked: every date is open unless an active booking already holds that night.
export default defineEventHandler((event): AvailabilityDay[] => {
  const { from, to } = getQuery(event) as { from?: string, to?: string }
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw createError({ statusCode: 400, statusMessage: 'from and to are required (yyyy-mm-dd)' })
  }
  const held = new Set<string>()
  for (const b of bookings.values()) {
    if (!ACTIVE_STATUSES.includes(b.status)) continue
    const nights = nightsBetween(b.startDate, b.endDate)
    for (let i = 0; i < nights; i++) {
      held.add(new Date(Date.parse(b.startDate) + i * 86_400_000).toISOString().slice(0, 10))
    }
  }
  const days: AvailabilityDay[] = []
  const end = Date.parse(to)
  for (let t = Date.parse(from); t <= end; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10)
    days.push({ date, status: held.has(date) ? 'booked' : 'available' })
  }
  return days
})
