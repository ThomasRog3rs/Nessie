import { randomUUID } from 'node:crypto'
import { addDays } from '../../shared/utils/dateRange.ts'
import { inTransaction } from './connection.ts'
import type { Database } from './connection.ts'

export const SEED_SITTER_ID = 'sitter-thomas-rogers'
export const SEED_BOOKER_ID = 'booker-demo'

type SeedStatus = 'requested' | 'declined' | 'accepted_times_pending' | 'confirmed' | 'cancelled' | 'completed'
type SeedEvent = [type: string, actor: 'booker' | 'sitter', message: string]

interface SeedBooking {
  status: SeedStatus
  /** Offsets in days from today. */
  startOffset: number
  endOffset: number
  agreedTimes?: [arrival: string, departure: string]
  pets: Array<{ name: string, species: string, notes: string }>
  serviceIds: string[]
  travelPence: number
  events: SeedEvent[]
}

const SERVICES = [
  { id: 'svc-walks', name: 'Extra dog walk', description: 'One additional 30 minute walk per day', price: 800 },
  { id: 'svc-plants', name: 'Plant watering', description: 'Indoor and garden plants', price: 500 },
  { id: 'svc-meds', name: 'Medication administration', description: 'Per day, as instructed', price: 600 },
]

const BLOCKS = [
  { startOffset: 10, endOffset: 16, reason: 'Annual leave' },
  { startOffset: 40, endOffset: 40, reason: 'Personal day' },
  { startOffset: 54, endOffset: 55, reason: 'Weekend away' },
]

const BOOKINGS: SeedBooking[] = [
  {
    status: 'confirmed', startOffset: 22, endOffset: 26, agreedTimes: ['09:30', '17:30'],
    pets: [{ name: 'Biscuit', species: 'Dog', notes: 'Two walks a day, afraid of fireworks.' }],
    serviceIds: ['svc-walks'], travelPence: 3400,
    events: [
      ['requested', 'booker', 'Requested stay. Times are requested, not yet agreed.'],
      ['accepted', 'sitter', 'Request accepted.'],
      ['times_agreed', 'sitter', 'Handover times confirmed: arrive 09:30, depart 17:30.'],
    ],
  },
  {
    status: 'accepted_times_pending', startOffset: 30, endOffset: 33,
    pets: [{ name: 'Mochi', species: 'Cat', notes: 'Indoor cat, wet food twice a day.' }],
    serviceIds: ['svc-plants'], travelPence: 0,
    events: [
      ['requested', 'booker', 'Requested stay. Times are requested, not yet agreed.'],
      ['accepted', 'sitter', 'Request accepted. Exact times to follow.'],
    ],
  },
  {
    status: 'requested', startOffset: 60, endOffset: 62,
    pets: [{ name: 'Biscuit', species: 'Dog', notes: '' }],
    serviceIds: [], travelPence: 0,
    events: [['requested', 'booker', 'Requested stay. Times are requested, not yet agreed.']],
  },
  {
    status: 'completed', startOffset: -20, endOffset: -16, agreedTimes: ['10:00', '16:00'],
    pets: [{ name: 'Biscuit', species: 'Dog', notes: '' }],
    serviceIds: [], travelPence: 2800,
    events: [
      ['requested', 'booker', 'Requested stay. Times are requested, not yet agreed.'],
      ['accepted', 'sitter', 'Request accepted.'],
      ['times_agreed', 'sitter', 'Handover times confirmed: arrive 10:00, depart 16:00.'],
      ['completed', 'sitter', 'Stay completed.'],
    ],
  },
  {
    status: 'cancelled', startOffset: 45, endOffset: 48,
    pets: [{ name: 'Mochi', species: 'Cat', notes: '' }],
    serviceIds: [], travelPence: 0,
    events: [
      ['requested', 'booker', 'Requested stay. Times are requested, not yet agreed.'],
      ['cancelled', 'booker', 'Cancelled by the booker: Plans changed.'],
    ],
  },
  {
    status: 'declined', startOffset: 70, endOffset: 72,
    pets: [{ name: 'Biscuit', species: 'Dog', notes: '' }],
    serviceIds: [], travelPence: 0,
    events: [
      ['requested', 'booker', 'Requested stay. Times are requested, not yet agreed.'],
      ['declined', 'sitter', 'Request declined.'],
    ],
  },
]

export function isSeeded(db: Database): boolean {
  return db.prepare('SELECT 1 AS found FROM sitters LIMIT 1').get() !== undefined
}

export function clearData(db: Database): void {
  for (const table of ['booking_attachments', 'sitter_expenses', 'booking_progress_updates', 'booking_history',
    'booking_incidental_expenses', 'booking_services', 'booking_pets', 'bookings', 'availability_blocks',
    'sitter_services', 'sitter_accepted_pets', 'booker_sitter_links', 'sitters', 'bookers']) {
    db.exec(`DELETE FROM ${table}`)
  }
}

/** Idempotency is the caller's job (see isSeeded); dates are relative to `today` so the demo never goes stale. */
export function seedDatabase(db: Database, today: string): void {
  const now = new Date().toISOString()
  inTransaction(db, () => {
    db.prepare('INSERT INTO bookers (id, name, email, created_at) VALUES (?, ?, ?, ?)')
      .run(SEED_BOOKER_ID, 'Demo Booker', 'booker@nesse.test', now)
    db.prepare(`INSERT INTO sitters (id, name, email, bio, location, contact_phone, rate_pence, rate_basis, currency, timezone, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'GBP', ?, ?)`).run(
      SEED_SITTER_ID, 'Thomas Rogers', 'thomas@nesse.test',
      'Experienced house and pet sitter. Comfortable with dogs, cats and small animals, and happy to keep plants and post in order.',
      'Bristol, UK', '07700 900 246',
      4500, 'per_night', 'Europe/London', now,
    )
    db.prepare('INSERT INTO booker_sitter_links (booker_id, sitter_id, created_at) VALUES (?, ?, ?)')
      .run(SEED_BOOKER_ID, SEED_SITTER_ID, now)

    const pet = db.prepare('INSERT INTO sitter_accepted_pets (sitter_id, species, position) VALUES (?, ?, ?)')
    ;['Dog', 'Cat', 'Small animal', 'Bird', 'Fish'].forEach((species, index) => pet.run(SEED_SITTER_ID, species, index))

    const service = db.prepare(`INSERT INTO sitter_services (id, sitter_id, name, description, price_pence, position)
      VALUES (?, ?, ?, ?, ?, ?)`)
    SERVICES.forEach((s, index) => service.run(s.id, SEED_SITTER_ID, s.name, s.description, s.price, index))

    const block = db.prepare('INSERT INTO availability_blocks (id, sitter_id, start_date, end_date, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    for (const b of BLOCKS) {
      block.run(randomUUID(), SEED_SITTER_ID, addDays(today, b.startOffset), addDays(today, b.endOffset), b.reason, now)
    }

    BOOKINGS.forEach(booking => insertBooking(db, booking, today, now))
  })
}

function insertBooking(db: Database, booking: SeedBooking, today: string, now: string): void {
  const id = randomUUID()
  const [agreedArrival, agreedDeparture] = booking.agreedTimes ?? [null, null]
  db.prepare(`INSERT INTO bookings (
      id, booker_id, sitter_id, status, start_date, end_date,
      requested_arrival_time, requested_departure_time, agreed_arrival_time, agreed_departure_time,
      timezone, sitter_name_snapshot, rate_pence, rate_basis, care_notes, property_instructions,
      travel_amount_pence, travel_notes, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relationship, vet_name, vet_phone, emergency_instructions,
      cancellation_term_acknowledged, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, '10:00', '17:00', ?, ?, 'Europe/London', 'Thomas Rogers', 4500, 'per_night',
      'Please follow the usual routine.', 'Spare key is with the neighbour at number 4.', ?, ?, 'Sam Carter', '07700 900123',
      'Sibling', 'Riverside Vets', '01632 960001', 'Call the vet first, then Sam.', 1, ?, ?)`)
    .run(
      id, SEED_BOOKER_ID, SEED_SITTER_ID, booking.status,
      addDays(today, booking.startOffset), addDays(today, booking.endOffset),
      agreedArrival, agreedDeparture,
      booking.travelPence, booking.travelPence > 0 ? 'Standard class return train' : '',
      now, now,
    )

  const pet = db.prepare('INSERT INTO booking_pets (booking_id, name, species, notes, position) VALUES (?, ?, ?, ?, ?)')
  booking.pets.forEach((p, index) => pet.run(id, p.name, p.species, p.notes, index))

  const service = db.prepare('INSERT INTO booking_services (booking_id, service_id, name, description, price_pence, position) VALUES (?, ?, ?, ?, ?, ?)')
  booking.serviceIds.forEach((serviceId, index) => {
    const s = SERVICES.find(candidate => candidate.id === serviceId)!
    service.run(id, s.id, s.name, s.description, s.price, index)
  })

  const history = db.prepare('INSERT INTO booking_history (id, booking_id, at, type, actor, message) VALUES (?, ?, ?, ?, ?, ?)')
  booking.events.forEach(([type, actor, message], index) => {
    history.run(randomUUID(), id, new Date(Date.parse(now) + index * 1000).toISOString(), type, actor, message)
  })
}
