import type { z } from 'zod'
import type { bookerProfileInputSchema } from '../schemas/account'
import type { bookingRequestSchema, cancelBookingSchema } from '../schemas/booking'
import type {
  agreeTimesSchema, attachmentKindSchema, availabilityBlockInputSchema, declineBookingSchema,
  progressUpdateSchema, sitterExpenseSchema, sitterProfileInputSchema,
} from '../schemas/sitter'

/** Money is always an integer in minor units (pence). */
export type Money = number

export type BookingStatus =
  | 'requested'
  | 'declined'
  | 'accepted_times_pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'

export type RateBasis = 'per_night' | 'per_day'

export type ActorRole = 'booker' | 'sitter'

export interface OptionalService {
  id: string
  name: string
  description?: string
  price: Money
}

export interface Sitter {
  id: string
  name: string
  location: string
  bio: string
  rate: Money
  rateBasis: RateBasis
  currency: 'GBP'
  /** IANA timezone of the property; all handover times are local to it. */
  timezone: string
  acceptedPets: string[]
  optionalServices: OptionalService[]
  phone?: string
}

export type SitterProfileInput = z.infer<typeof sitterProfileInputSchema>
export type SitterProfile = Omit<Sitter, 'timezone' | 'currency'> & { phone: string }
export type ProgressUpdateInput = z.infer<typeof progressUpdateSchema>
export type SitterExpenseInput = z.infer<typeof sitterExpenseSchema>
export type AttachmentKind = z.infer<typeof attachmentKindSchema>

export interface BookingProgressUpdate {
  id: string
  date: string
  message: string
  creatorId: string
  createdAt: string
}

export interface SitterExpense {
  id: string
  category: 'travel' | 'incidental'
  description: string
  amount: Money
  creatorId: string
  createdAt: string
  receipt?: BookingAttachment
}

export interface BookingAttachment {
  id: string
  bookingId: string
  expenseId?: string
  kind: AttachmentKind
  fileName: string
  mimeType: string
  size: number
  caption?: string
  creatorId: string
  createdAt: string
}

export type DayStatus = 'available' | 'unavailable' | 'booked'

export interface AvailabilityDay {
  /** yyyy-mm-dd */
  date: string
  status: DayStatus
}

export interface AvailabilityBlock {
  id: string
  /** yyyy-mm-dd, inclusive */
  startDate: string
  /** yyyy-mm-dd, inclusive */
  endDate: string
  reason: string
}

export type AvailabilityBlockInput = z.infer<typeof availabilityBlockInputSchema>

export type BookingRequest = z.infer<typeof bookingRequestSchema>
export type Pet = BookingRequest['pets'][number]
export type IncidentalExpense = BookingRequest['incidentalExpenses'][number]
export type EmergencyContact = BookingRequest['emergencyContact']
export type CancelBookingRequest = z.infer<typeof cancelBookingSchema>
export type DeclineBookingRequest = z.infer<typeof declineBookingSchema>
export type AgreeTimesRequest = z.infer<typeof agreeTimesSchema>

export type HistoryEventType =
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'times_proposed'
  | 'times_agreed'
  | 'changed'
  | 'cancelled'
  | 'completed'
  | 'progress_update'
  | 'expense_recorded'
  | 'photo_added'
  | 'receipt_added'
  | 'attachment_removed'

export interface BookingHistoryEntry {
  id: string
  /** ISO 8601 instant */
  at: string
  type: HistoryEventType
  actor: ActorRole
  message: string
}

export interface BookingPricing {
  nights: number
  sitting: Money
  services: Money
  travel: Money
  incidentals: Money
  total: Money
}

export interface Booking extends BookingRequest {
  id: string
  status: BookingStatus
  timezone: string
  createdAt: string
  sitterName: string
  rate: Money
  rateBasis: RateBasis
  /** Services as priced when the request was made. */
  services: OptionalService[]
  /** HH:mm, set once the sitter has confirmed exact handover times. */
  agreedArrivalTime: string | null
  agreedDepartureTime: string | null
  pricing: BookingPricing
  history: BookingHistoryEntry[]
}

/** What the booker sees for one booking: the proposal, recorded costs, and shared attachments. */
export type BookerBooking = Booking & {
  sitterExpenses: SitterExpense[]
  attachments: BookingAttachment[]
}

export type SitterBooking = Omit<Booking,
  'propertyInstructions' | 'emergencyContact' | 'vet' | 'emergencyInstructions'
> & {
  bookerName: string
  propertyInstructions?: string
  emergencyContact?: EmergencyContact
  vet?: Booking['vet']
  emergencyInstructions?: string
  progressUpdates: BookingProgressUpdate[]
  sitterExpenses: SitterExpense[]
  attachments: BookingAttachment[]
}

export type ApiErrorCode =
  | 'validation_failed'
  | 'not_found'
  | 'conflict'
  | 'invalid_transition'
  | 'unauthorized'
  | 'forbidden'
  | 'gone'
  | 'internal_error'

export interface ApiErrorData {
  code: ApiErrorCode
  fieldErrors?: Record<string, string[]>
}

export type BookerProfileInput = z.infer<typeof bookerProfileInputSchema>
export type BookerProfile = BookerProfileInput & { email: string }

export type AccountRole = 'sitter' | 'booker' | 'none'

export interface AccountState {
  signedIn: boolean
  role: AccountRole
  /** True only while no sitter has registered; the sitter sign-up is closed once one exists. */
  sitterSignupOpen: boolean
}

export type InviteStatus = 'active' | 'used' | 'expired' | 'disabled'

export interface BookerInvite {
  id: string
  label: string
  createdAt: string
  expiresAt: string
  status: InviteStatus
  usedAt?: string
  bookerName?: string
}

/** The raw token is only ever returned from the call that creates the invite. */
export interface CreatedBookerInvite extends BookerInvite {
  token: string
}

export interface InvitePreview {
  valid: boolean
  sitterName?: string
}

export interface LinkedBooker {
  id: string
  name: string
  email: string
  phone: string
  joinedAt: string
  inviteLabel: string
}
