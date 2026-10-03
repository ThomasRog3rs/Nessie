import type { AgreeTimesRequest, Booking } from '../../shared/types/booking.ts'
import { todayInTimeZone } from '../../shared/utils/dateRange.ts'
import { canApply } from '../domain/bookingStateMachine.ts'
import { InvalidTransitionError, NotFoundError } from '../domain/errors.ts'
import type { BookingCommands, BookingQueries, TransactionRunner } from '../repositories/contracts.ts'
import type { BookingLifecycle } from './BookingLifecycle.ts'
import type { Clock } from './ports.ts'

export interface SitterBookingServiceDependencies {
  queries: BookingQueries
  commands: BookingCommands
  lifecycle: BookingLifecycle
  transactions: TransactionRunner
  clock: Clock
}

/** Sitter-facing booking use cases: decide on requests, agree times, cancel and complete. */
export class SitterBookingService {
  private readonly deps: SitterBookingServiceDependencies

  constructor(deps: SitterBookingServiceDependencies) {
    this.deps = deps
  }

  list(sitterId: string): Booking[] {
    return this.deps.queries.listForSitter(sitterId)
  }

  accept(sitterId: string, bookingId: string): Booking {
    return this.act(sitterId, bookingId, 'accept', 'Request accepted. Exact handover times to follow.')
  }

  decline(sitterId: string, bookingId: string, reason?: string): Booking {
    const trimmed = reason?.trim()
    return this.act(sitterId, bookingId, 'decline', trimmed ? `Request declined: ${trimmed}` : 'Request declined.')
  }

  cancel(sitterId: string, bookingId: string, reason?: string): Booking {
    const trimmed = reason?.trim()
    return this.act(sitterId, bookingId, 'cancel', trimmed ? `Cancelled by the sitter: ${trimmed}` : 'Cancelled by the sitter.')
  }

  agreeTimes(sitterId: string, bookingId: string, times: AgreeTimesRequest): Booking {
    return this.act(sitterId, bookingId, 'agree_times',
      `Handover times confirmed: arrive ${times.arrivalTime}, depart ${times.departureTime}.`,
      booking => this.deps.commands.setAgreedTimes(booking.id, times.arrivalTime, times.departureTime, this.deps.clock.now().toISOString()))
  }

  complete(sitterId: string, bookingId: string): Booking {
    return this.act(sitterId, bookingId, 'complete', 'Stay completed.', (booking) => {
      const stayEnded = todayInTimeZone(booking.timezone, this.deps.clock.now()) >= booking.endDate
      if (canApply(booking.status, 'complete') && !stayEnded) {
        throw new InvalidTransitionError('A booking can only be completed once the stay has ended')
      }
    })
  }

  private act(
    sitterId: string,
    bookingId: string,
    action: Parameters<BookingLifecycle['apply']>[1],
    message: string,
    beforeApply?: (booking: Booking) => void,
  ): Booking {
    return this.deps.transactions.run(() => {
      const booking = this.deps.queries.findForSitter(bookingId, sitterId)
      if (!booking) throw new NotFoundError('Booking not found')
      this.deps.lifecycle.apply(booking, action, 'sitter', message)
      beforeApply?.(booking)
      return this.deps.queries.findForSitter(bookingId, sitterId)!
    })
  }
}
