import { MockActorProvider } from '../auth/MockActorProvider.ts'
import type { Database } from '../db/connection.ts'
import { SqliteAvailabilityBlockRepository } from '../repositories/sqlite/SqliteAvailabilityBlockRepository.ts'
import { SqliteBookingRepository } from '../repositories/sqlite/SqliteBookingRepository.ts'
import { SqliteSitterRepository } from '../repositories/sqlite/SqliteSitterRepository.ts'
import { SqliteTransactionRunner } from '../repositories/sqlite/SqliteTransactionRunner.ts'
import { AvailabilityBlockService } from './AvailabilityBlockService.ts'
import { AvailabilityService } from './AvailabilityService.ts'
import { BookingLifecycle } from './BookingLifecycle.ts'
import { BookingService } from './BookingService.ts'
import { systemClock, uuidGenerator } from './ports.ts'
import type { Clock, CurrentActorProvider, IdGenerator } from './ports.ts'
import { SitterBookingService } from './SitterBookingService.ts'
import { SitterService } from './SitterService.ts'

export interface AppServices {
  actors: CurrentActorProvider
  sitters: SitterService
  availability: AvailabilityService
  availabilityBlocks: AvailabilityBlockService
  bookings: BookingService
  sitterBookings: SitterBookingService
}

/** Composition root: the only place concrete implementations are wired to their abstractions. */
export function createServices(
  db: Database,
  options: { clock?: Clock, ids?: IdGenerator, actors?: CurrentActorProvider } = {},
): AppServices {
  const clock = options.clock ?? systemClock
  const ids = options.ids ?? uuidGenerator

  const sitterRepository = new SqliteSitterRepository(db)
  const blockRepository = new SqliteAvailabilityBlockRepository(db)
  const bookingRepository = new SqliteBookingRepository(db)
  const transactions = new SqliteTransactionRunner(db)

  const availability = new AvailabilityService(blockRepository, bookingRepository)
  const lifecycle = new BookingLifecycle(bookingRepository, clock, ids)

  return {
    actors: options.actors ?? new MockActorProvider(),
    sitters: new SitterService(sitterRepository),
    availability,
    availabilityBlocks: new AvailabilityBlockService(blockRepository, bookingRepository, clock, ids),
    bookings: new BookingService({
      sitters: sitterRepository, queries: bookingRepository, commands: bookingRepository,
      availability, lifecycle, transactions, clock, ids,
    }),
    sitterBookings: new SitterBookingService({
      queries: bookingRepository, commands: bookingRepository, lifecycle, transactions, clock,
    }),
  }
}
