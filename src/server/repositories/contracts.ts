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
  findById(sitterId: string): Promise<Sitter | undefined>
  /** The sitter a booker has a preferred relationship with. */
  findPreferredForBooker(bookerId: string): Promise<Sitter | undefined>
  updateProfile(sitterId: string, input: PersistableSitterProfile): Promise<void>
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
  findSitterIdByClerkUser(clerkUserId: string): Promise<string | undefined>
  findBookerIdByClerkUser(clerkUserId: string): Promise<string | undefined>
  /** Number of sitters that have been linked to a sign-in account. */
  countClaimedSitters(): Promise<number>
  /** A sitter row that exists but has never been linked to a sign-in account (e.g. demo data). */
  findUnclaimedSitterId(): Promise<string | undefined>
  claimSitter(sitterId: string, clerkUserId: string, email: string): Promise<void>
  insertSitter(sitter: { id: string, clerkUserId: string, email: string, createdAt: string }): Promise<void>

  insertInvite(invite: NewInvite): Promise<void>
  findInviteByHash(tokenHash: string): Promise<InviteRecord | undefined>
  listInvites(sitterId: string): Promise<Array<Omit<BookerInvite, 'status'> & { disabledAt?: string }>>
  disableInvite(sitterId: string, inviteId: string, at: string): Promise<boolean>
  /** Atomically spends a still-usable invite; false when it was already used, disabled or expired. */
  consumeInvite(inviteId: string, bookerId: string, at: string): Promise<boolean>

  insertBooker(booker: NewBooker): Promise<void>
  linkBookerToSitter(bookerId: string, sitterId: string, createdAt: string): Promise<void>
  findBookerProfile(bookerId: string): Promise<BookerProfile | undefined>
  updateBookerProfile(bookerId: string, profile: BookerProfileInput): Promise<void>
  listBookersForSitter(sitterId: string): Promise<LinkedBooker[]>
}

export interface AvailabilityBlockRepository {
  findById(sitterId: string, blockId: string): Promise<AvailabilityBlock | undefined>
  /** Blocks whose inclusive range intersects the inclusive range `from`..`to`. */
  listIntersecting(sitterId: string, from: string, to: string): Promise<AvailabilityBlock[]>
  listAll(sitterId: string): Promise<AvailabilityBlock[]>
  insert(sitterId: string, input: AvailabilityBlockInput, id: string, createdAt: string): Promise<AvailabilityBlock>
  update(blockId: string, input: AvailabilityBlockInput): Promise<void>
  delete(blockId: string): Promise<void>
}

export interface NewBooking {
  booking: Booking
  bookerId: string
  sitterId: string
}

export interface BookingQueries {
  findForBooker(bookingId: string, bookerId: string): Promise<Booking | undefined>
  findForSitter(bookingId: string, sitterId: string): Promise<Booking | undefined>
  findBookerNameForSitter(bookingId: string, sitterId: string): Promise<string | undefined>
  listForBooker(bookerId: string): Promise<Booking[]>
  listForSitter(sitterId: string): Promise<Booking[]>
  /** Date spans of bookings holding the sitter's dates, intersecting [from, to). */
  listActiveSpans(sitterId: string, from: string, to: string): Promise<DateSpan[]>
  listProgressUpdates(bookingId: string): Promise<BookingProgressUpdate[]>
  listSitterExpenses(bookingId: string): Promise<SitterExpense[]>
  listAttachments(bookingId: string): Promise<BookingAttachment[]>
  findAttachment(bookingId: string, attachmentId: string): Promise<BookingAttachment | undefined>
  findAttachmentStorageKey(bookingId: string, attachmentId: string): Promise<string | undefined>
}

export interface BookingCommands {
  insert(newBooking: NewBooking): Promise<void>
  updateStatus(bookingId: string, status: BookingStatus, updatedAt: string): Promise<void>
  setAgreedTimes(bookingId: string, arrival: string, departure: string, updatedAt: string): Promise<void>
  appendHistory(bookingId: string, entry: BookingHistoryEntry): Promise<void>
  insertProgressUpdate(bookingId: string, update: BookingProgressUpdate): Promise<void>
  insertSitterExpense(bookingId: string, expense: SitterExpense): Promise<void>
  insertAttachment(attachment: BookingAttachment & { storageKey: string }): Promise<void>
  deleteAttachment(bookingId: string, attachmentId: string): Promise<void>
}

/** Runs work atomically; nested calls join the active write transaction. */
export interface TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>
}
