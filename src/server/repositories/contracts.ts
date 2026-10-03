import type {
  AvailabilityBlock, AvailabilityBlockInput, Booking, BookingAttachment, BookingHistoryEntry,
  BookerInvite, BookerProfile, BookerProfileInput, BookingProgressUpdate, BookingStatus, LinkedBooker, Sitter, SitterExpense, SitterProfileInput,
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

export interface InviteRecord {
  id: string
  sitterId: string
  sitterName: string
  expiresAt: string
  disabledAt?: string
  usedAt?: string
}

export interface NewInvite {
  id: string
  sitterId: string
  tokenHash: string
  label: string
  createdAt: string
  expiresAt: string
}

export interface NewBooker {
  id: string
  clerkUserId: string
  email: string
  createdAt: string
  profile: BookerProfileInput
}

export interface AccountRepository {
  findSitterIdByClerkUser(clerkUserId: string): string | undefined
  findBookerIdByClerkUser(clerkUserId: string): string | undefined
  /** Number of sitters that have been linked to a sign-in account. */
  countClaimedSitters(): number
  /** A sitter row that exists but has never been linked to a sign-in account (e.g. demo data). */
  findUnclaimedSitterId(): string | undefined
  claimSitter(sitterId: string, clerkUserId: string, email: string): void
  insertSitter(sitter: { id: string, clerkUserId: string, email: string, createdAt: string }): void

  insertInvite(invite: NewInvite): void
  findInviteByHash(tokenHash: string): InviteRecord | undefined
  listInvites(sitterId: string): Array<Omit<BookerInvite, 'status'> & { disabledAt?: string }>
  disableInvite(sitterId: string, inviteId: string, at: string): boolean
  /** Atomically spends a still-usable invite; false when it was already used, disabled or expired. */
  consumeInvite(inviteId: string, bookerId: string, at: string): boolean

  insertBooker(booker: NewBooker): void
  linkBookerToSitter(bookerId: string, sitterId: string, createdAt: string): void
  findBookerProfile(bookerId: string): BookerProfile | undefined
  updateBookerProfile(bookerId: string, profile: BookerProfileInput): void
  listBookersForSitter(sitterId: string): LinkedBooker[]
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
