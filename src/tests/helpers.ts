import { resolve } from 'node:path'
import { openDatabase } from '../server/db/connection.ts'
import type { Database } from '../server/db/connection.ts'
import { FileMigrationSource, Migrator } from '../server/db/migrator.ts'
import { SEED_BOOKER_ID, SEED_SITTER_ID, seedDatabase } from '../server/db/seed.ts'
import { createServices } from '../server/services/composition.ts'
import type { AppServices } from '../server/services/composition.ts'
import type { BookingRequest } from '../shared/types/booking.ts'
import { addDays } from '../shared/utils/dateRange.ts'

export const TODAY = '2030-01-01'
export const migrationSource = new FileMigrationSource(resolve(import.meta.dirname, '../server/db/migrations'))

export async function createMigratedDatabase(): Promise<Database> {
  const db = openDatabase(':memory:')
  await new Migrator(db, migrationSource).migrate()
  return db
}

export interface TestContext {
  db: Database
  services: AppServices
  bookerId: string
  sitterId: string
}

/** Seeded in-memory app whose clock is fixed at noon on TODAY. */
export async function createContext(): Promise<TestContext> {
  const db = await createMigratedDatabase()
  seedDatabase(db, TODAY)
  const services = createServices(db, { clock: { now: () => new Date(`${TODAY}T12:00:00Z`) } })
  return { db, services, bookerId: SEED_BOOKER_ID, sitterId: SEED_SITTER_ID }
}

export function bookingRequest(startOffset: number, endOffset: number, overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    sitterId: SEED_SITTER_ID,
    startDate: addDays(TODAY, startOffset),
    endDate: addDays(TODAY, endOffset),
    arrivalTime: '10:00',
    departureTime: '17:00',
    pets: [{ name: 'Rex', species: 'Dog', notes: '' }],
    careNotes: '',
    propertyInstructions: '',
    optionalServiceIds: [],
    travelReimbursement: { amount: 0, notes: '' },
    incidentalExpenses: [],
    emergencyContact: { name: 'Sam', phone: '07700 900000', relationship: 'Friend' },
    vet: { name: '', phone: '' },
    emergencyInstructions: '',
    cancellationTermAcknowledged: false,
    ...overrides,
  }
}
