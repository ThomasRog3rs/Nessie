import { z } from 'zod'
import { isoDateSchema, longText, moneySchema, requiredText, shortText, timeOfDaySchema } from './primitives'

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

export const sitterProfileInputSchema = z.object({
  name: requiredText(100),
  location: requiredText(120),
  bio: longText(1000),
  phone: shortText(30),
  rate: moneySchema,
  rateBasis: z.enum(['per_night', 'per_day']),
  acceptedPets: z.array(requiredText(40)).max(20),
  optionalServices: z.array(z.object({
    id: z.string().min(1).max(80).optional(),
    name: requiredText(100),
    description: shortText(250).optional(),
    price: moneySchema,
  })).max(30),
})

export const progressUpdateSchema = z.object({
  message: requiredText(1000),
  date: isoDateSchema.optional(),
})

export const sitterExpenseSchema = z.object({
  category: z.enum(['travel', 'incidental']),
  description: requiredText(120),
  amount: moneySchema.min(1, 'Amount must be greater than zero'),
})

export const attachmentKindSchema = z.enum(['receipt', 'photo'])
export const attachmentCaptionSchema = z.object({ caption: longText(250).optional() })
