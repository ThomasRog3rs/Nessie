import type {
  ActorRole, Booking, BookingAttachment, BookingHistoryEntry, BookingProgressUpdate, BookingStatus,
  HistoryEventType, RateBasis, SitterExpense,
} from '../../../shared/types/booking.ts'
import { calculatePricing } from '../../../shared/utils/pricing.ts'
import { stayNights } from '../../../shared/utils/dateRange.ts'
import { getAll, getRow, runStatement } from '../../db/connection.ts'
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

  findForBooker(bookingId: string, bookerId: string): Promise<Booking | undefined> {
    return this.findOne('id = ? AND booker_id = ?', [bookingId, bookerId])
  }

  findForSitter(bookingId: string, sitterId: string): Promise<Booking | undefined> {
    return this.findOne('id = ? AND sitter_id = ?', [bookingId, sitterId])
  }

  async findBookerNameForSitter(bookingId: string, sitterId: string): Promise<string | undefined> {
    const row = await getRow<{ name: string }>(this.db, `SELECT b.name FROM bookings k JOIN bookers b ON b.id = k.booker_id
      WHERE k.id = ? AND k.sitter_id = ?`, [bookingId, sitterId])
    return row?.name
  }

  listForBooker(bookerId: string): Promise<Booking[]> {
    return this.findMany('booker_id = ?', [bookerId])
  }

  listForSitter(sitterId: string): Promise<Booking[]> {
    return this.findMany('sitter_id = ?', [sitterId])
  }

  async listActiveSpans(sitterId: string, from: string, to: string): Promise<DateSpan[]> {
    const rows = await getAll<{ start_date: string, end_date: string }>(this.db, `SELECT start_date, end_date FROM bookings
      WHERE sitter_id = ? AND status IN (${ACTIVE_PLACEHOLDERS}) AND start_date < ? AND end_date > ? ORDER BY start_date`,
    [sitterId, ...ACTIVE_STATUSES, to, from])
    return rows.map(row => ({ startDate: row.start_date, endDate: row.end_date }))
  }

  async listProgressUpdates(bookingId: string): Promise<BookingProgressUpdate[]> {
    return getAll<BookingProgressUpdate>(
      this.db,
      `SELECT id, update_date AS date, message, creator_id AS creatorId, created_at AS createdAt
      FROM booking_progress_updates WHERE booking_id = ? ORDER BY created_at, id`,
      [bookingId],
    )
  }

  async listSitterExpenses(bookingId: string): Promise<SitterExpense[]> {
    const rows = await getAll<Omit<SitterExpense, 'receipt'>>(
      this.db,
      `SELECT id, category, description, amount_pence AS amount, creator_id AS creatorId, created_at AS createdAt
      FROM sitter_expenses WHERE booking_id = ? ORDER BY created_at, id`,
      [bookingId],
    )
    const receipts = (await this.listAttachments(bookingId)).filter(attachment => attachment.kind === 'receipt')
    return rows.map((expense) => {
      const receipt = receipts.find(attachment => attachment.expenseId === expense.id)
      return { ...expense, ...(receipt ? { receipt } : {}) }
    })
  }

  async listAttachments(bookingId: string): Promise<BookingAttachment[]> {
    const rows = await getAll<AttachmentRow>(this.db, `SELECT id, booking_id, expense_id, kind, file_name, mime_type, size_bytes,
      caption, creator_id, created_at FROM booking_attachments WHERE booking_id = ? ORDER BY created_at, id`, [bookingId])
    return rows.map(row => this.mapAttachment(row))
  }

  async findAttachment(bookingId: string, attachmentId: string): Promise<BookingAttachment | undefined> {
    const row = await getRow<AttachmentRow>(this.db, `SELECT id, booking_id, expense_id, kind, file_name, mime_type, size_bytes,
      caption, creator_id, created_at FROM booking_attachments WHERE booking_id = ? AND id = ?`, [bookingId, attachmentId])
    return row && this.mapAttachment(row)
  }

  async findAttachmentStorageKey(bookingId: string, attachmentId: string): Promise<string | undefined> {
    const row = await getRow<{ storage_key: string }>(
      this.db,
      'SELECT storage_key FROM booking_attachments WHERE booking_id = ? AND id = ?',
      [bookingId, attachmentId],
    )
    return row?.storage_key
  }

  async insert({ booking, bookerId, sitterId }: NewBooking): Promise<void> {
    await runStatement(this.db, `INSERT INTO bookings (
        id, booker_id, sitter_id, status, start_date, end_date, requested_arrival_time, requested_departure_time,
        agreed_arrival_time, agreed_departure_time, timezone, sitter_name_snapshot, rate_pence, rate_basis,
        care_notes, property_instructions, travel_amount_pence, travel_notes,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        vet_name, vet_phone, emergency_instructions, cancellation_term_acknowledged, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      booking.id, bookerId, sitterId, booking.status, booking.startDate, booking.endDate,
      booking.arrivalTime, booking.departureTime, booking.timezone, booking.sitterName, booking.rate, booking.rateBasis,
      booking.careNotes, booking.propertyInstructions, booking.travelReimbursement.amount, booking.travelReimbursement.notes,
      booking.emergencyContact.name, booking.emergencyContact.phone, booking.emergencyContact.relationship,
      booking.vet.name, booking.vet.phone, booking.emergencyInstructions, booking.cancellationTermAcknowledged ? 1 : 0,
      booking.createdAt, booking.createdAt,
    ])

    for (const [index, pet] of booking.pets.entries()) {
      await runStatement(this.db, 'INSERT INTO booking_pets (booking_id, name, species, notes, position) VALUES (?, ?, ?, ?, ?)',
        [booking.id, pet.name, pet.species, pet.notes, index])
    }

    for (const [index, service] of booking.services.entries()) {
      await runStatement(this.db, `INSERT INTO booking_services (booking_id, service_id, name, description, price_pence, position)
      VALUES (?, ?, ?, ?, ?, ?)`, [booking.id, service.id, service.name, service.description ?? '', service.price, index])
    }

    for (const [index, expense] of booking.incidentalExpenses.entries()) {
      await runStatement(this.db, 'INSERT INTO booking_incidental_expenses (booking_id, description, amount_pence, position) VALUES (?, ?, ?, ?)',
        [booking.id, expense.description, expense.amount, index])
    }

    for (const entry of booking.history) await this.appendHistory(booking.id, entry)
  }

  async updateStatus(bookingId: string, status: BookingStatus, updatedAt: string): Promise<void> {
    await runStatement(this.db, 'UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?', [status, updatedAt, bookingId])
  }

  async setAgreedTimes(bookingId: string, arrival: string, departure: string, updatedAt: string): Promise<void> {
    await runStatement(this.db, 'UPDATE bookings SET agreed_arrival_time = ?, agreed_departure_time = ?, updated_at = ? WHERE id = ?',
      [arrival, departure, updatedAt, bookingId])
  }

  async appendHistory(bookingId: string, entry: BookingHistoryEntry): Promise<void> {
    await runStatement(this.db, 'INSERT INTO booking_history (id, booking_id, at, type, actor, message) VALUES (?, ?, ?, ?, ?, ?)',
      [entry.id, bookingId, entry.at, entry.type, entry.actor, entry.message])
  }

  async insertProgressUpdate(bookingId: string, update: BookingProgressUpdate): Promise<void> {
    await runStatement(this.db, `INSERT INTO booking_progress_updates (id, booking_id, update_date, message, creator_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`, [update.id, bookingId, update.date, update.message, update.creatorId, update.createdAt])
  }

  async insertSitterExpense(bookingId: string, expense: SitterExpense): Promise<void> {
    await runStatement(this.db, `INSERT INTO sitter_expenses (id, booking_id, category, description, amount_pence, creator_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [expense.id, bookingId, expense.category, expense.description, expense.amount, expense.creatorId, expense.createdAt])
  }

  async insertAttachment(attachment: BookingAttachment & { storageKey: string }): Promise<void> {
    await runStatement(this.db, `INSERT INTO booking_attachments
      (id, booking_id, expense_id, kind, storage_key, file_name, mime_type, size_bytes, caption, creator_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      attachment.id, attachment.bookingId, attachment.expenseId ?? null, attachment.kind, attachment.storageKey,
      attachment.fileName, attachment.mimeType, attachment.size, attachment.caption ?? '', attachment.creatorId, attachment.createdAt,
    ])
  }

  async deleteAttachment(bookingId: string, attachmentId: string): Promise<void> {
    await runStatement(this.db, 'DELETE FROM booking_attachments WHERE booking_id = ? AND id = ?', [bookingId, attachmentId])
  }

  private async findOne(where: string, params: string[]): Promise<Booking | undefined> {
    const row = await getRow<BookingRow>(this.db, `SELECT * FROM bookings WHERE ${where}`, params)
    return row && this.hydrate(row)
  }

  private async findMany(where: string, params: string[]): Promise<Booking[]> {
    const rows = await getAll<BookingRow>(this.db, `SELECT * FROM bookings WHERE ${where} ORDER BY created_at DESC, id`, params)
    return Promise.all(rows.map(row => this.hydrate(row)))
  }

  private async hydrate(row: BookingRow): Promise<Booking> {
    const pets = await getAll<Booking['pets'][number]>(
      this.db,
      'SELECT name, species, notes FROM booking_pets WHERE booking_id = ? ORDER BY position',
      [row.id],
    )
    const serviceRows = await getAll<Array<{ service_id: string, name: string, description: string, price_pence: number }>[number]>(
      this.db,
      'SELECT service_id, name, description, price_pence FROM booking_services WHERE booking_id = ? ORDER BY position',
      [row.id],
    )
    const expenseRows = await getAll<Array<{ description: string, amount_pence: number }>[number]>(
      this.db,
      'SELECT description, amount_pence FROM booking_incidental_expenses WHERE booking_id = ? ORDER BY position',
      [row.id],
    )
    const history = await getAll<HistoryRow>(
      this.db,
      'SELECT id, at, type, actor, message FROM booking_history WHERE booking_id = ? ORDER BY at, rowid',
      [row.id],
    )

    const services = serviceRows.map(service => ({
      id: service.service_id,
      name: service.name,
      ...(service.description ? { description: service.description } : {}),
      price: service.price_pence,
    }))
    const incidentalExpenses = expenseRows.map(expense => ({ description: expense.description, amount: expense.amount_pence }))

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
      pets: pets.map(pet => ({ name: pet.name, species: pet.species, notes: pet.notes })),
      careNotes: row.care_notes,
      propertyInstructions: row.property_instructions,
      optionalServiceIds: services.map(service => service.id),
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
