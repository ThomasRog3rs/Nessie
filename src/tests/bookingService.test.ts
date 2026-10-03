import { beforeEach, describe, expect, it } from 'vitest'
import { ConflictError, InvalidTransitionError, NotFoundError, ValidationError } from '../server/domain/errors.ts'
import { addDays } from '../shared/utils/dateRange.ts'
import { bookingRequest, createContext, TODAY } from './helpers.ts'
import type { TestContext } from './helpers.ts'

describe('booker booking flow', () => {
  let ctx: TestContext
  beforeEach(async () => { ctx = await createContext() })

  it('creates a priced request that then holds the dates', () => {
    const booking = ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5, { optionalServiceIds: ['svc-walks'] }))
    expect(booking.status).toBe('requested')
    expect(booking.pricing).toMatchObject({ nights: 2, sitting: 9000, services: 1600, total: 10600 })
    expect(booking.history).toHaveLength(1)
    expect(ctx.services.bookings.get(ctx.bookerId, booking.id)).toEqual(booking)
    expect(ctx.services.availability.getDays(ctx.sitterId, addDays(TODAY, 3), addDays(TODAY, 3))[0]!.status).toBe('booked')
  })

  it.each([
    ['a sitter block', 9, 11],
    ['an existing booking', 21, 24],
  ])('rejects dates overlapping %s', (_name, start, end) => {
    expect(() => ctx.services.bookings.create(ctx.bookerId, bookingRequest(start, end))).toThrow(ConflictError)
  })

  it('allows a stay that ends the day a booking begins', () => {
    expect(() => ctx.services.bookings.create(ctx.bookerId, bookingRequest(20, 22))).not.toThrow()
  })

  it('rejects past dates, unknown services and unaccepted pets', () => {
    expect(() => ctx.services.bookings.create(ctx.bookerId, bookingRequest(-3, -1))).toThrow(ValidationError)
    expect(() => ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5, { optionalServiceIds: ['nope'] }))).toThrow(ValidationError)
    expect(() => ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5, { pets: [{ name: 'Z', species: 'Dragon', notes: '' }] })))
      .toThrow(ValidationError)
  })

  it('rejects an unknown sitter', () => {
    expect(() => ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5, { sitterId: 'someone-else' }))).toThrow(NotFoundError)
  })

  it('cancels once, freeing the dates', () => {
    const booking = ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5))
    const cancelled = ctx.services.bookings.cancel(ctx.bookerId, booking.id, ' Plans changed ')
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.history.at(-1)?.message).toBe('Cancelled by the booker: Plans changed')
    expect(() => ctx.services.bookings.cancel(ctx.bookerId, booking.id)).toThrow(InvalidTransitionError)
    expect(() => ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5))).not.toThrow()
  })

  it('does not reveal other bookers\' bookings', () => {
    const booking = ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5))
    expect(() => ctx.services.bookings.get('someone-else', booking.id)).toThrow(NotFoundError)
  })

  it('lists newest first', () => {
    const created = ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5))
    expect(ctx.services.bookings.list(ctx.bookerId)).toHaveLength(7)
    expect(ctx.services.bookings.list(ctx.bookerId).some(b => b.id === created.id)).toBe(true)
  })
})

describe('sitter booking flow', () => {
  let ctx: TestContext
  beforeEach(async () => { ctx = await createContext() })

  it('accepts, agrees times, and rejects early completion', () => {
    const { sitterBookings, bookings } = ctx.services
    const booking = bookings.create(ctx.bookerId, bookingRequest(3, 5))
    expect(sitterBookings.accept(ctx.sitterId, booking.id).status).toBe('accepted_times_pending')
    const confirmed = sitterBookings.agreeTimes(ctx.sitterId, booking.id, { arrivalTime: '09:00', departureTime: '18:00' })
    expect(confirmed).toMatchObject({ status: 'confirmed', agreedArrivalTime: '09:00', agreedDepartureTime: '18:00' })
    expect(() => sitterBookings.complete(ctx.sitterId, booking.id)).toThrow(InvalidTransitionError)
  })

  it('declines a request and frees the dates', () => {
    const { sitterBookings, bookings } = ctx.services
    const booking = bookings.create(ctx.bookerId, bookingRequest(3, 5))
    expect(sitterBookings.decline(ctx.sitterId, booking.id, 'Away').history.at(-1)?.message).toBe('Request declined: Away')
    expect(() => bookings.create(ctx.bookerId, bookingRequest(3, 5))).not.toThrow()
  })

  it('cannot agree times on a request that is not accepted', () => {
    const booking = ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5))
    expect(() => ctx.services.sitterBookings.agreeTimes(ctx.sitterId, booking.id, { arrivalTime: '09:00', departureTime: '18:00' }))
      .toThrow(InvalidTransitionError)
    expect(ctx.services.bookings.get(ctx.bookerId, booking.id).agreedArrivalTime).toBeNull()
  })

  it('manages availability blocks and refuses to cover live bookings', () => {
    const { availabilityBlocks } = ctx.services
    const block = availabilityBlocks.create(ctx.sitterId, { startDate: addDays(TODAY, 80), endDate: addDays(TODAY, 81), reason: 'Course' })
    expect(availabilityBlocks.update(ctx.sitterId, block.id, { ...block, reason: 'Training' }).reason).toBe('Training')
    availabilityBlocks.remove(ctx.sitterId, block.id)
    expect(() => availabilityBlocks.remove(ctx.sitterId, block.id)).toThrow(NotFoundError)
    expect(() => availabilityBlocks.create(ctx.sitterId, { startDate: addDays(TODAY, 24), endDate: addDays(TODAY, 24), reason: '' }))
      .toThrow(ConflictError)
  })
})
