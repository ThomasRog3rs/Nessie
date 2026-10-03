import type { AvailabilityDay, DayStatus } from '../../shared/types/booking.ts'
import { addDays, eachDate, stayNights } from '../../shared/utils/dateRange.ts'
import { ValidationError } from '../domain/errors.ts'
import type { AvailabilityBlockRepository, BookingQueries } from '../repositories/contracts.ts'

export const MAX_AVAILABILITY_DAYS = 366

export type StayConflict = 'blocked' | 'booked'

/** Answers "is this sitter free?"; days with no stored data are available. */
export class AvailabilityService {
  private readonly blocks: AvailabilityBlockRepository
  private readonly bookings: BookingQueries

  constructor(blocks: AvailabilityBlockRepository, bookings: BookingQueries) {
    this.blocks = blocks
    this.bookings = bookings
  }

  getDays(sitterId: string, from: string, to: string): AvailabilityDay[] {
    const dates = eachDate(from, to)
    if (dates.length > MAX_AVAILABILITY_DAYS) {
      throw new ValidationError(`Availability can be requested for at most ${MAX_AVAILABILITY_DAYS} days`, { to: ['Range is too long'] })
    }

    const status = new Map<string, DayStatus>()
    for (const block of this.blocks.listIntersecting(sitterId, from, to)) {
      eachDate(block.startDate, block.endDate).forEach(date => status.set(date, 'unavailable'))
    }
    for (const span of this.bookings.listActiveSpans(sitterId, from, addDays(to, 1))) {
      stayNights(span.startDate, span.endDate).forEach(date => status.set(date, 'booked'))
    }
    return dates.map(date => ({ date, status: status.get(date) ?? 'available' }))
  }

  /** Checks the nights [startDate, endDate) against blocks and active bookings. */
  findStayConflict(sitterId: string, startDate: string, endDate: string): StayConflict | undefined {
    if (this.blocks.listIntersecting(sitterId, startDate, addDays(endDate, -1)).length > 0) return 'blocked'
    if (this.bookings.listActiveSpans(sitterId, startDate, endDate).length > 0) return 'booked'
    return undefined
  }
}
