const DAY_MS = 86_400_000

function toUtc(date: string): number {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function nightsBetween(startDate: string, endDate: string): number {
  return Math.round((toUtc(endDate) - toUtc(startDate)) / DAY_MS)
}

export function formatMoney(minor: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100)
}

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(toUtc(date)))
}

export function formatInstant(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(iso))
}
