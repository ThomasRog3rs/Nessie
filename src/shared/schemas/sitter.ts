import { z } from 'zod'
import { isoDateSchema, longText, timeOfDaySchema } from './primitives'

export const availabilityBlockInputSchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  reason: longText(200),
}).refine(value => value.endDate >= value.startDate, {
  path: ['endDate'],
  error: 'The end date must not be before the start date',
})

export const declineBookingSchema = z.object({
  reason: longText(500).optional(),
})

export const agreeTimesSchema = z.object({
  arrivalTime: timeOfDaySchema,
  departureTime: timeOfDaySchema,
})
