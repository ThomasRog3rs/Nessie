import type {
  ActorRole, Booking, BookingAttachment, BookingHistoryEntry, BookingProgressUpdate, BookingStatus,
  HistoryEventType, RateBasis, SitterExpense,
} from '../../../shared/types/booking.ts'
import { calculatePricing } from '../../../shared/utils/pricing.ts'
import { stayNights } from '../../../shared/utils/dateRange.ts'
import type { Database } from '../../db/connection.ts'
import { ACTIVE_STATUSES } from '../../domain/bookingStateMachine.ts'
import type { BookingCommands, BookingQueries, DateSpan, NewBooking } from '../contracts.ts'

interface BookingRow {
  id: string
  status: BookingStatus
  start_date: string
  end_date: string
  requested_arrival_time: string
  requested_departure_time: string
  agreed_arrival_time: string | null
  agreed_departure_time: string | null
  timezone: string
  sitter_id: string
  sitter_name_snapshot: string
  rate_pence: number
  rate_basis: RateBasis
  care_notes: string
  property_instructions: string
  travel_amount_pence: number
  travel_notes: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  vet_name: string
  vet_phone: string
  emergency_instructions: string
  cancellation_term_acknowledged: number
  created_at: string
}

interface HistoryRow {
  id: string
  at: string
  type: HistoryEventType
  actor: ActorRole
  message: string
}

interface AttachmentRow {
  id: string
  booking_id: string
  expense_id: string | null
  kind: BookingAttachment['kind']
  file_name: string
  mime_type: string
  size_bytes: number
  caption: string
  creator_id: string
  created_at: string
}

const ACTIVE_PLACEHOLDERS = ACTIVE_STATUSES.map(() => '?').join(', ')

export class SqliteBookingRepository implements BookingQueries, BookingCommands {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  findForBooker(bookingId: string, bookerId: string): Booking | undefined {
    return this.findOne('id = ? AND booker_id = ?', [bookingId, bookerId])
  }

  findForSitter(bookingId: string, sitterId: string): Booking | undefined {
    return this.findOne('id = ? AND sitter_id = ?', [bookingId, sitterId])
  }

  findBookerNameForSitter(bookingId: string, sitterId: string): string | undefined {
    const row = this.db.prepare(`SELECT b.name FROM bookings k JOIN bookers b ON b.id = k.booker_id
      WHERE k.id = ? AND k.sitter_id = ?`).get(bookingId, sitterId) as { name: string } | undefined
    return row?.name
  }

  listForBooker(bookerId: string): Booking[] {
    return this.findMany('booker_id = ?', [bookerId])
  }

  listForSitter(sitterId: string): Booking[] {
    return this.findMany('sitter_id = ?', [sitterId])
  }

  listActiveSpans(sitterId: string, from: string, to: string): DateSpan[] {
    const rows = this.db.prepare(`SELECT start_date, end_date FROM bookings
      WHERE sitter_id = ? AND status IN (${ACTIVE_PLACEHOLDERS}) AND start_date < ? AND end_date > ? ORDER BY start_date`)
      .all(sitterId, ...ACTIVE_STATUSES, to, from) as unknown as Array<{ start_date: string, end_date: string }>
    return rows.map(row => ({ startDate: row.start_date, endDate: row.end_date }))
  }

  listProgressUpdates(bookingId: string): BookingProgressUpdate[] {
    const rows = this.db.prepare(`SELECT id, update_date AS date, message, creator_id AS creatorId, created_at AS createdAt
      FROM booking_progress_updates WHERE booking_id = ? ORDER BY created_at, id`).all(bookingId) as unknown as BookingProgressUpdate[]
    return rows
  }

  listSitterExpenses(bookingId: string): SitterExpense[] {
    const rows = this.db.prepare(`SELECT id, category, description, amount_pence AS amount, creator_id AS creatorId, created_at AS createdAt
      FROM sitter_expenses WHERE booking_id = ? ORDER BY created_at, id`).all(bookingId) as unknown as Omit<SitterExpense, 'receipt'>[]
    const receipts = this.listAttachments(bookingId).filter(attachment => attachment.kind === 'receipt')
    return rows.map((expense) => {
      const receipt = receipts.find(attachment => attachment.expenseId === expense.id)
      return { ...expense, ...(receipt ? { receipt } : {}) }
    })
  }

  listAttachments(bookingId: string): BookingAttachment[] {
    const rows = this.db.prepare(`SELECT id, booking_id, expense_id, kind, file_name, mime_type, size_bytes,
      caption, creator_id, created_at FROM booking_attachments WHERE booking_id = ? ORDER BY created_at, id`)
      .all(bookingId) as unknown as AttachmentRow[]
    return rows.map(row => this.mapAttachment(row))
  }

  findAttachment(bookingId: string, attachmentId: string): BookingAttachment | undefined {
    const row = this.db.prepare(`SELECT id, booking_id, expense_id, kind, file_name, mime_type, size_bytes,
      caption, creator_id, created_at FROM booking_attachments WHERE booking_id = ? AND id = ?`)
      .get(bookingId, attachmentId) as AttachmentRow | undefined
    return row && this.mapAttachment(row)
  }

  findAttachmentStorageKey(bookingId: string, attachmentId: string): string | undefined {
    const row = this.db.prepare('SELECT storage_key FROM booking_attachments WHERE booking_id = ? AND id = ?')
      .get(bookingId, attachmentId) as { storage_key: string } | undefined
    return row?.storage_key
  }

  insert({ booking, bookerId, sitterId }: NewBooking): void {
    this.db.prepare(`INSERT INTO bookings (
        id, booker_id, sitter_id, status, start_date, end_date, requested_arrival_time, requested_departure_time,
        agreed_arrival_time, agreed_departure_time, timezone, sitter_name_snapshot, rate_pence, rate_basis,
        care_notes, property_instructions, travel_amount_pence, travel_notes,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        vet_name, vet_phone, emergency_instructions, cancellation_term_acknowledged, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      booking.id, bookerId, sitterId, booking.status, booking.startDate, booking.endDate,
      booking.arrivalTime, booking.departureTime, booking.timezone, booking.sitterName, booking.rate, booking.rateBasis,
      booking.careNotes, booking.propertyInstructions, booking.travelReimbursement.amount, booking.travelReimbursement.notes,
      booking.emergencyContact.name, booking.emergencyContact.phone, booking.emergencyContact.relationship,
      booking.vet.name, booking.vet.phone, booking.emergencyInstructions, booking.cancellationTermAcknowledged ? 1 : 0,
      booking.createdAt, booking.createdAt,
    )

    const pet = this.db.prepare('INSERT INTO booking_pets (booking_id, name, species, notes, position) VALUES (?, ?, ?, ?, ?)')
    booking.pets.forEach((p, index) => pet.run(booking.id, p.name, p.species, p.notes, index))

    const service = this.db.prepare(`INSERT INTO booking_services (booking_id, service_id, name, description, price_pence, position)
      VALUES (?, ?, ?, ?, ?, ?)`)
    booking.services.forEach((s, index) => service.run(booking.id, s.id, s.name, s.description ?? '', s.price, index))

    const expense = this.db.prepare('INSERT INTO booking_incidental_expenses (booking_id, description, amount_pence, position) VALUES (?, ?, ?, ?)')
    booking.incidentalExpenses.forEach((e, index) => expense.run(booking.id, e.description, e.amount, index))

    booking.history.forEach(entry => this.appendHistory(booking.id, entry))
  }

  updateStatus(bookingId: string, status: BookingStatus, updatedAt: string): void {
    this.db.prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?').run(status, updatedAt, bookingId)
  }

  setAgreedTimes(bookingId: string, arrival: string, departure: string, updatedAt: string): void {
    this.db.prepare('UPDATE bookings SET agreed_arrival_time = ?, agreed_departure_time = ?, updated_at = ? WHERE id = ?')
      .run(arrival, departure, updatedAt, bookingId)
  }

  appendHistory(bookingId: string, entry: BookingHistoryEntry): void {
    this.db.prepare('INSERT INTO booking_history (id, booking_id, at, type, actor, message) VALUES (?, ?, ?, ?, ?, ?)')
      .run(entry.id, bookingId, entry.at, entry.type, entry.actor, entry.message)
  }

  insertProgressUpdate(bookingId: string, update: BookingProgressUpdate): void {
    this.db.prepare(`INSERT INTO booking_progress_updates (id, booking_id, update_date, message, creator_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(update.id, bookingId, update.date, update.message, update.creatorId, update.createdAt)
  }

  insertSitterExpense(bookingId: string, expense: SitterExpense): void {
    this.db.prepare(`INSERT INTO sitter_expenses (id, booking_id, category, description, amount_pence, creator_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      expense.id, bookingId, expense.category, expense.description, expense.amount, expense.creatorId, expense.createdAt,
    )
  }

  insertAttachment(attachment: BookingAttachment & { storageKey: string }): void {
    this.db.prepare(`INSERT INTO booking_attachments
      (id, booking_id, expense_id, kind, storage_key, file_name, mime_type, size_bytes, caption, creator_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      attachment.id, attachment.bookingId, attachment.expenseId ?? null, attachment.kind, attachment.storageKey,
      attachment.fileName, attachment.mimeType, attachment.size, attachment.caption ?? '', attachment.creatorId, attachment.createdAt,
    )
  }

  deleteAttachment(bookingId: string, attachmentId: string): void {
    this.db.prepare('DELETE FROM booking_attachments WHERE booking_id = ? AND id = ?').run(bookingId, attachmentId)
  }

  private findOne(where: string, params: string[]): Booking | undefined {
    const row = this.db.prepare(`SELECT * FROM bookings WHERE ${where}`).get(...params) as BookingRow | undefined
    return row && this.hydrate(row)
  }

  private findMany(where: string, params: string[]): Booking[] {
    const rows = this.db.prepare(`SELECT * FROM bookings WHERE ${where} ORDER BY created_at DESC, id`)
      .all(...params) as unknown as BookingRow[]
    return rows.map(row => this.hydrate(row))
  }

  private hydrate(row: BookingRow): Booking {
    const pets = this.db.prepare('SELECT name, species, notes FROM booking_pets WHERE booking_id = ? ORDER BY position')
      .all(row.id) as unknown as Booking['pets']
    const serviceRows = this.db.prepare('SELECT service_id, name, description, price_pence FROM booking_services WHERE booking_id = ? ORDER BY position')
      .all(row.id) as unknown as Array<{ service_id: string, name: string, description: string, price_pence: number }>
    const expenseRows = this.db.prepare('SELECT description, amount_pence FROM booking_incidental_expenses WHERE booking_id = ? ORDER BY position')
      .all(row.id) as unknown as Array<{ description: string, amount_pence: number }>
    const history = this.db.prepare('SELECT id, at, type, actor, message FROM booking_history WHERE booking_id = ? ORDER BY at, rowid')
      .all(row.id) as unknown as HistoryRow[]

    const services = serviceRows.map(s => ({
      id: s.service_id,
      name: s.name,
      ...(s.description ? { description: s.description } : {}),
      price: s.price_pence,
    }))
    const incidentalExpenses = expenseRows.map(e => ({ description: e.description, amount: e.amount_pence }))

    return {
      id: row.id,
      sitterId: row.sitter_id,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      arrivalTime: row.requested_arrival_time,
      departureTime: row.requested_departure_time,
      agreedArrivalTime: row.agreed_arrival_time,
      agreedDepartureTime: row.agreed_departure_time,
      timezone: row.timezone,
      createdAt: row.created_at,
      sitterName: row.sitter_name_snapshot,
      rate: row.rate_pence,
      rateBasis: row.rate_basis,
      pets: pets.map(p => ({ name: p.name, species: p.species, notes: p.notes })),
      careNotes: row.care_notes,
      propertyInstructions: row.property_instructions,
      optionalServiceIds: services.map(s => s.id),
      services,
      travelReimbursement: { amount: row.travel_amount_pence, notes: row.travel_notes },
      incidentalExpenses,
      emergencyContact: {
        name: row.emergency_contact_name,
        phone: row.emergency_contact_phone,
        relationship: row.emergency_contact_relationship,
      },
      vet: { name: row.vet_name, phone: row.vet_phone },
      emergencyInstructions: row.emergency_instructions,
      cancellationTermAcknowledged: row.cancellation_term_acknowledged === 1,
      pricing: calculatePricing({
        nights: stayNights(row.start_date, row.end_date).length,
        rate: row.rate_pence,
        services,
        travelAmount: row.travel_amount_pence,
        incidentalExpenses,
      }),
      history,
    }
  }

  private mapAttachment(row: AttachmentRow): BookingAttachment {
    return {
      id: row.id,
      bookingId: row.booking_id,
      ...(row.expense_id ? { expenseId: row.expense_id } : {}),
      kind: row.kind,
      fileName: row.file_name,
      mimeType: row.mime_type,
      size: row.size_bytes,
      ...(row.caption ? { caption: row.caption } : {}),
      creatorId: row.creator_id,
      createdAt: row.created_at,
    }
  }
}
