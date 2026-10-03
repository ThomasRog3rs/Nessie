import type { AvailabilityBlock, AvailabilityBlockInput } from '../../shared/types/booking.ts'
import { addDays } from '../../shared/utils/dateRange.ts'
import { ConflictError, NotFoundError } from '../domain/errors.ts'
import type { AvailabilityBlockRepository, BookingQueries } from '../repositories/contracts.ts'
import type { Clock, IdGenerator } from './ports.ts'

/** Sitter-facing management of the dates they are not working. */
export class AvailabilityBlockService {
  private readonly blocks: AvailabilityBlockRepository
  private readonly bookings: BookingQueries
  private readonly clock: Clock
  private readonly ids: IdGenerator

  constructor(blocks: AvailabilityBlockRepository, bookings: BookingQueries, clock: Clock, ids: IdGenerator) {
    this.blocks = blocks
    this.bookings = bookings
    this.clock = clock
    this.ids = ids
  }

  list(sitterId: string): AvailabilityBlock[] {
    return this.blocks.listAll(sitterId)
  }

  create(sitterId: string, input: AvailabilityBlockInput): AvailabilityBlock {
    this.assertNoBookingClash(sitterId, input)
    return this.blocks.insert(sitterId, input, this.ids.next(), this.clock.now().toISOString())
  }

  update(sitterId: string, blockId: string, input: AvailabilityBlockInput): AvailabilityBlock {
    this.require(sitterId, blockId)
    this.assertNoBookingClash(sitterId, input)
    this.blocks.update(blockId, input)
    return { id: blockId, ...input }
  }

  remove(sitterId: string, blockId: string): void {
    this.require(sitterId, blockId)
    this.blocks.delete(blockId)
  }

  private require(sitterId: string, blockId: string): AvailabilityBlock {
    const block = this.blocks.findById(sitterId, blockId)
    if (!block) throw new NotFoundError('Availability block not found')
    return block
  }

  private assertNoBookingClash(sitterId: string, input: AvailabilityBlockInput): void {
    if (this.bookings.listActiveSpans(sitterId, input.startDate, addDays(input.endDate, 1)).length > 0) {
      throw new ConflictError('These dates overlap an existing booking. Cancel the booking first.')
    }
  }
}
