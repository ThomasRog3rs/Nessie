import type {
  AvailabilityBlock, AvailabilityBlockInput, Booking, BookingHistoryEntry, BookingStatus, Sitter,
} from '../../shared/types/booking.ts'

export interface DateSpan {
  startDate: string
  endDate: string
}

export interface SitterRepository {
  findById(sitterId: string): Sitter | undefined
  /** The sitter a booker has a preferred relationship with. */
  findPreferredForBooker(bookerId: string): Sitter | undefined
}

export interface AvailabilityBlockRepository {
  findById(sitterId: string, blockId: string): AvailabilityBlock | undefined
  /** Blocks whose inclusive range intersects the inclusive range `from`..`to`. */
  listIntersecting(sitterId: string, from: string, to: string): AvailabilityBlock[]
  listAll(sitterId: string): AvailabilityBlock[]
  insert(sitterId: string, input: AvailabilityBlockInput, id: string, createdAt: string): AvailabilityBlock
  update(blockId: string, input: AvailabilityBlockInput): void
  delete(blockId: string): void
}

export interface NewBooking {
  booking: Booking
  bookerId: string
  sitterId: string
}

export interface BookingQueries {
  findForBooker(bookingId: string, bookerId: string): Booking | undefined
  findForSitter(bookingId: string, sitterId: string): Booking | undefined
  listForBooker(bookerId: string): Booking[]
  listForSitter(sitterId: string): Booking[]
  /** Date spans of bookings holding the sitter's dates, intersecting [from, to). */
  listActiveSpans(sitterId: string, from: string, to: string): DateSpan[]
}

export interface BookingCommands {
  insert(newBooking: NewBooking): void
  updateStatus(bookingId: string, status: BookingStatus, updatedAt: string): void
  setAgreedTimes(bookingId: string, arrival: string, departure: string, updatedAt: string): void
  appendHistory(bookingId: string, entry: BookingHistoryEntry): void
}

/** Runs work atomically; synchronous because the SQLite driver is. */
export interface TransactionRunner {
  run<T>(work: () => T): T
}
