import { describe, expect, it } from 'vitest'
import { canApply, isActive, nextStatus } from '../server/domain/bookingStateMachine.ts'
import { InvalidTransitionError } from '../server/domain/errors.ts'

describe('bookingStateMachine', () => {
  it('follows the happy path', () => {
    expect(nextStatus('requested', 'accept')).toBe('accepted_times_pending')
    expect(nextStatus('accepted_times_pending', 'agree_times')).toBe('confirmed')
    expect(nextStatus('confirmed', 'complete')).toBe('completed')
  })

  it('rejects illegal transitions', () => {
    expect(() => nextStatus('cancelled', 'cancel')).toThrow(InvalidTransitionError)
    expect(() => nextStatus('requested', 'complete')).toThrow(InvalidTransitionError)
    expect(canApply('declined', 'accept')).toBe(false)
  })

  it('only holds dates for live bookings', () => {
    expect(['requested', 'accepted_times_pending', 'confirmed'].every(s => isActive(s as never))).toBe(true)
    expect(['declined', 'cancelled', 'completed'].some(s => isActive(s as never))).toBe(false)
  })
})
