import type {
  AvailabilityBlock, AvailabilityBlockInput, Booking, BookingAttachment, BookingHistoryEntry,
  BookingProgressUpdate, BookingStatus, Sitter, SitterExpense, SitterProfileInput,
} from '../../shared/types/booking.ts'

export interface DateSpan {
  startDate: string
  endDate: string
}

export type PersistableSitterProfile = Omit<SitterProfileInput, 'optionalServices'> & {
  optionalServices: Array<SitterProfileInput['optionalServices'][number] & { id: string }>
}

export interface SitterRepository {
  findById(sitterId: string): Sitter | undefined
  /** The sitter a booker has a preferred relationship with. */
  findPreferredForBooker(bookerId: string): Sitter | undefined
  updateProfile(sitterId: string, input: PersistableSitterProfile): void
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
  findBookerNameForSitter(bookingId: string, sitterId: string): string | undefined
  listForBooker(bookerId: string): Booking[]
  listForSitter(sitterId: string): Booking[]
  /** Date spans of bookings holding the sitter's dates, intersecting [from, to). */
  listActiveSpans(sitterId: string, from: string, to: string): DateSpan[]
  listProgressUpdates(bookingId: string): BookingProgressUpdate[]
  listSitterExpenses(bookingId: string): SitterExpense[]
  listAttachments(bookingId: string): BookingAttachment[]
  findAttachment(bookingId: string, attachmentId: string): BookingAttachment | undefined
  findAttachmentStorageKey(bookingId: string, attachmentId: string): string | undefined
}

export interface BookingCommands {
  insert(newBooking: NewBooking): void
  updateStatus(bookingId: string, status: BookingStatus, updatedAt: string): void
  setAgreedTimes(bookingId: string, arrival: string, departure: string, updatedAt: string): void
  appendHistory(bookingId: string, entry: BookingHistoryEntry): void
  insertProgressUpdate(bookingId: string, update: BookingProgressUpdate): void
  insertSitterExpense(bookingId: string, expense: SitterExpense): void
  insertAttachment(attachment: BookingAttachment & { storageKey: string }): void
  deleteAttachment(bookingId: string, attachmentId: string): void
}

/** Runs work atomically; synchronous because the SQLite driver is. */
export interface TransactionRunner {
  run<T>(work: () => T): T
}
