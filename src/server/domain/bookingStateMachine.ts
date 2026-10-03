import type { BookingStatus } from '../../shared/types/booking.ts'
import { InvalidTransitionError } from './errors.ts'

export type BookingAction = 'accept' | 'decline' | 'agree_times' | 'cancel' | 'complete'

/** Statuses that hold the sitter's dates. */
export const ACTIVE_STATUSES: readonly BookingStatus[] = ['requested', 'accepted_times_pending', 'confirmed']

const TRANSITIONS: Readonly<Record<BookingStatus, Partial<Record<BookingAction, BookingStatus>>>> = {
  requested: { accept: 'accepted_times_pending', decline: 'declined', cancel: 'cancelled' },
  accepted_times_pending: { agree_times: 'confirmed', cancel: 'cancelled' },
  confirmed: { agree_times: 'confirmed', cancel: 'cancelled', complete: 'completed' },
  declined: {},
  cancelled: {},
  completed: {},
}

const ACTION_LABELS: Readonly<Record<BookingAction, string>> = {
  accept: 'accepted',
  decline: 'declined',
  agree_times: 'have its times agreed',
  cancel: 'cancelled',
  complete: 'completed',
}

export function canApply(status: BookingStatus, action: BookingAction): boolean {
  return TRANSITIONS[status][action] !== undefined
}

export function nextStatus(status: BookingStatus, action: BookingAction): BookingStatus {
  const next = TRANSITIONS[status][action]
  if (!next) throw new InvalidTransitionError(`A ${status.replaceAll('_', ' ')} booking cannot be ${ACTION_LABELS[action]}`)
  return next
}

export function isActive(status: BookingStatus): boolean {
  return ACTIVE_STATUSES.includes(status)
}
