import { z } from 'zod'
import { emergencyContactSchema, petSchema } from './booking'
import { longText, requiredText, shortText } from './primitives'

export const bookerProfileInputSchema = z.object({
  name: requiredText(100),
  phone: requiredText(30),
  addressLine: requiredText(200),
  city: requiredText(80),
  postcode: requiredText(12),
  emergencyContact: emergencyContactSchema,
  vet: z.object({ name: shortText(80), phone: shortText(30) }),
  emergencyInstructions: longText(),
  propertyInstructions: longText(),
  pets: z.array(petSchema).max(10),
})

/** Longest lifetime a sitter can give an invite link: 90 days. */
export const MAX_INVITE_LIFETIME_HOURS = 24 * 90

export const createInviteSchema = z.object({
  label: shortText(80).optional(),
  expiresInHours: z.number().int().min(1).max(MAX_INVITE_LIFETIME_HOURS),
})

export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/, 'Invalid invite link')
