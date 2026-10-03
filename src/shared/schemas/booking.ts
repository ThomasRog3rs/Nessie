import { z } from 'zod'
import { isoDateSchema, longText, moneySchema, requiredText, shortText, timeOfDaySchema } from './primitives'

export const petSchema = z.object({
  name: requiredText(60),
  species: requiredText(40),
  notes: longText(500),
})

export const incidentalExpenseSchema = z.object({
  description: requiredText(120),
  amount: moneySchema,
})

export const emergencyContactSchema = z.object({
  name: requiredText(80),
  phone: requiredText(30),
  relationship: shortText(60),
})

export const bookingRequestSchema = z.object({
  sitterId: z.string().min(1),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  arrivalTime: timeOfDaySchema,
  departureTime: timeOfDaySchema,
  pets: z.array(petSchema).min(1, 'Add at least one pet').max(10),
  careNotes: longText(),
  propertyInstructions: longText(),
  optionalServiceIds: z.array(z.string().min(1)).max(20),
  travelReimbursement: z.object({ amount: moneySchema, notes: longText(500) }),
  incidentalExpenses: z.array(incidentalExpenseSchema).max(20),
  emergencyContact: emergencyContactSchema,
  vet: z.object({ name: shortText(80), phone: shortText(30) }),
  emergencyInstructions: longText(),
  cancellationTermAcknowledged: z.boolean(),
}).refine(value => value.endDate > value.startDate, {
  path: ['endDate'],
  error: 'The departure date must be after the arrival date',
})

export const cancelBookingSchema = z.object({
  reason: longText(500).optional(),
})

export const availabilityQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
}).refine(({ from, to }) => to >= from, { path: ['to'], error: '`to` must not be before `from`' })

export const bookingIdSchema = z.uuid()
