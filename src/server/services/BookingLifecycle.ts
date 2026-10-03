import type { ActorRole, Booking, HistoryEventType } from '../../shared/types/booking.ts'
import { nextStatus } from '../domain/bookingStateMachine.ts'
import type { BookingAction } from '../domain/bookingStateMachine.ts'
import type { BookingCommands } from '../repositories/contracts.ts'
import type { Clock, IdGenerator } from './ports.ts'

const HISTORY_TYPE: Readonly<Record<BookingAction, HistoryEventType>> = {
  accept: 'accepted',
  decline: 'declined',
  agree_times: 'times_agreed',
  cancel: 'cancelled',
  complete: 'completed',
}

/** Applies a state-machine action and records it in the booking history; shared by booker and sitter services. */
export class BookingLifecycle {
  private readonly commands: BookingCommands
  private readonly clock: Clock
  private readonly ids: IdGenerator

  constructor(commands: BookingCommands, clock: Clock, ids: IdGenerator) {
    this.commands = commands
    this.clock = clock
    this.ids = ids
  }

  async apply(booking: Booking, action: BookingAction, actor: ActorRole, message: string): Promise<void> {
    const status = nextStatus(booking.status, action)
    const at = this.clock.now().toISOString()
    await this.commands.updateStatus(booking.id, status, at)
    await this.commands.appendHistory(booking.id, { id: this.ids.next(), at, type: HISTORY_TYPE[action], actor, message })
  }
}
