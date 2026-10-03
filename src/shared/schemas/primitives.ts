import { z } from 'zod'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const isoDateSchema = z.string().regex(DATE_PATTERN, 'Dates must be yyyy-mm-dd').refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}, 'Not a real calendar date')

export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Times must be HH:mm')

export const moneySchema = z.number().int('Amounts are whole pence').min(0).max(10_000_000)

export const shortText = (max = 120) => z.string().trim().max(max)
export const requiredText = (max = 120) => shortText(max).min(1, 'Required')
export const longText = (max = 2000) => z.string().trim().max(max)
