import type { Database } from '../db/connection.ts'
import { SqliteAccountRepository } from '../repositories/sqlite/SqliteAccountRepository.ts'
import { SqliteAvailabilityBlockRepository } from '../repositories/sqlite/SqliteAvailabilityBlockRepository.ts'
import { SqliteBookingRepository } from '../repositories/sqlite/SqliteBookingRepository.ts'
import { SqliteSitterRepository } from '../repositories/sqlite/SqliteSitterRepository.ts'
import { SqliteTransactionRunner } from '../repositories/sqlite/SqliteTransactionRunner.ts'
import { AccountService } from './AccountService.ts'
import { AvailabilityBlockService } from './AvailabilityBlockService.ts'
import { AvailabilityService } from './AvailabilityService.ts'
import { BookingLifecycle } from './BookingLifecycle.ts'
import { BookingService } from './BookingService.ts'
import { systemClock, uuidGenerator } from './ports.ts'
import type { Clock, IdGenerator } from './ports.ts'
import { SitterBookingService } from './SitterBookingService.ts'
import { SitterService } from './SitterService.ts'

export interface AppServices {
  accounts: AccountService
  sitters: SitterService
  availability: AvailabilityService
  availabilityBlocks: AvailabilityBlockService
  bookings: BookingService
  sitterBookings: SitterBookingService
}

/** Composition root: the only place concrete implementations are wired to their abstractions. */
export function createServices(
  db: Database,
  options: { clock?: Clock, ids?: IdGenerator } = {},
): AppServices {
  const clock = options.clock ?? systemClock
  const ids = options.ids ?? uuidGenerator

  const sitterRepository = new SqliteSitterRepository(db)
  const blockRepository = new SqliteAvailabilityBlockRepository(db)
  const bookingRepository = new SqliteBookingRepository(db)
  const accountRepository = new SqliteAccountRepository(db)
  const transactions = new SqliteTransactionRunner(db)
  const sitters = new SitterService(sitterRepository, transactions, ids)

  const availability = new AvailabilityService(blockRepository, bookingRepository)
  const lifecycle = new BookingLifecycle(bookingRepository, clock, ids)

  return {
    accounts: new AccountService({ accounts: accountRepository, sitters, transactions, clock, ids }),
    sitters,
    availability,
    availabilityBlocks: new AvailabilityBlockService(blockRepository, bookingRepository, clock, ids),
    bookings: new BookingService({
      sitters: sitterRepository, queries: bookingRepository, commands: bookingRepository,
      availability, lifecycle, transactions, clock, ids,
    }),
    sitterBookings: new SitterBookingService({
      queries: bookingRepository, commands: bookingRepository, lifecycle, transactions, clock, ids,
    }),
  }
}
