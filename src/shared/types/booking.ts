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

export interface OptionalService {
  id: string
  name: string
  description?: string
  price: Money
}

export interface Sitter {
  id: string
  name: string
  bio: string
  rate: Money
  rateBasis: RateBasis
  currency: 'GBP'
  /** IANA timezone of the property; all handover times are local to it. */
  timezone: string
  acceptedPets: string[]
  optionalServices: OptionalService[]
}

export type DayStatus = 'available' | 'unavailable' | 'booked'

export interface AvailabilityDay {
  /** yyyy-mm-dd */
  date: string
  status: DayStatus
}

export interface Pet {
  name: string
  species: string
  notes: string
}

export interface IncidentalExpense {
  description: string
  amount: Money
}

export interface EmergencyContact {
  name: string
  phone: string
  relationship: string
}

export interface BookingRequest {
  sitterId: string
  /** yyyy-mm-dd, arrival day */
  startDate: string
  /** yyyy-mm-dd, departure day */
  endDate: string
  /** HH:mm, requested (not agreed) local time at the property */
  arrivalTime: string
  departureTime: string
  pets: Pet[]
  careNotes: string
  propertyInstructions: string
  optionalServiceIds: string[]
  travelReimbursement: { amount: Money, notes: string }
  incidentalExpenses: IncidentalExpense[]
  emergencyContact: EmergencyContact
  vet: { name: string, phone: string }
  emergencyInstructions: string
  /** FR-25: booker has acknowledged the 72-hour cancellation term */
  cancellationTermAcknowledged: boolean
}

export type HistoryEventType =
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'times_proposed'
  | 'times_agreed'
  | 'changed'
  | 'cancelled'
  | 'completed'

export interface BookingHistoryEntry {
  id: string
  /** ISO 8601 instant */
  at: string
  type: HistoryEventType
  actor: 'booker' | 'sitter'
  message: string
}

export interface Booking extends BookingRequest {
  id: string
  status: BookingStatus
  timezone: string
  createdAt: string
  sitterName: string
  rate: Money
  rateBasis: RateBasis
  history: BookingHistoryEntry[]
}

export interface CancelBookingRequest {
  reason?: string
}
