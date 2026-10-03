const DAY_MS = 86_400_000

/** Calendar-date arithmetic on yyyy-mm-dd strings, independent of the host timezone. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Every date from `from` to `to`, both inclusive. */
export function eachDate(from: string, to: string): string[] {
  const dates: string[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date)
  return dates
}

/** The nights a stay occupies: arrival day up to, but excluding, the departure day. */
export function stayNights(startDate: string, endDate: string): string[] {
  return endDate > startDate ? eachDate(startDate, addDays(endDate, -1)) : []
}

/** Today's calendar date at the property. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
