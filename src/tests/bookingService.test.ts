import { beforeEach, describe, expect, it } from 'vitest'
import { ConflictError, InvalidTransitionError, NotFoundError, ValidationError } from '../server/domain/errors.ts'
import { addDays } from '../shared/utils/dateRange.ts'
import { bookingRequest, createContext, TODAY } from './helpers.ts'
import type { TestContext } from './helpers.ts'

describe('booker booking flow', () => {
  let ctx: TestContext
  beforeEach(async () => { ctx = await createContext() })

  it('creates a priced request that then holds the dates', async () => {
    const booking = await ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5, { optionalServiceIds: ['svc-walks'] }))
    expect(booking.status).toBe('requested')
    expect(booking.pricing).toMatchObject({ nights: 2, sitting: 9000, services: 1600, total: 10600 })
    expect(booking.history).toHaveLength(1)
    expect(await ctx.services.bookings.get(ctx.bookerId, booking.id)).toEqual({ ...booking, sitterExpenses: [], attachments: [] })
    expect((await ctx.services.availability.getDays(ctx.sitterId, addDays(TODAY, 3), addDays(TODAY, 3)))[0]!.status).toBe('booked')
  })

  it.each([
    ['a sitter block', 9, 11],
    ['an existing booking', 21, 24],
  ])('rejects dates overlapping %s', async (_name, start, end) => {
    await expect(ctx.services.bookings.create(ctx.bookerId, bookingRequest(start, end))).rejects.toThrow(ConflictError)
  })

  it('allows a stay that ends the day a booking begins', async () => {
    await expect(ctx.services.bookings.create(ctx.bookerId, bookingRequest(20, 22))).resolves.toBeTruthy()
  })

  it('rejects past dates, unknown services and unaccepted pets', async () => {
    await expect(ctx.services.bookings.create(ctx.bookerId, bookingRequest(-3, -1))).rejects.toThrow(ValidationError)
    await expect(ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5, { optionalServiceIds: ['nope'] }))).rejects.toThrow(ValidationError)
    await expect(ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5, { pets: [{ name: 'Z', species: 'Dragon', notes: '' }] })))
      .rejects.toThrow(ValidationError)
  })

  it('rejects an unknown sitter', async () => {
    await expect(ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5, { sitterId: 'someone-else' }))).rejects.toThrow(NotFoundError)
  })

  it('cancels once, freeing the dates', async () => {
    const booking = await ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5))
    const cancelled = await ctx.services.bookings.cancel(ctx.bookerId, booking.id, ' Plans changed ')
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.history.at(-1)?.message).toBe('Cancelled by the booker: Plans changed')
    await expect(ctx.services.bookings.cancel(ctx.bookerId, booking.id)).rejects.toThrow(InvalidTransitionError)
    await expect(ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5))).resolves.toBeTruthy()
  })

  it('does not reveal other bookers\' bookings', async () => {
    const booking = await ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5))
    await expect(ctx.services.bookings.get('someone-else', booking.id)).rejects.toThrow(NotFoundError)
  })

  it('lists newest first', async () => {
    const created = await ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5))
    expect(await ctx.services.bookings.list(ctx.bookerId)).toHaveLength(7)
    expect((await ctx.services.bookings.list(ctx.bookerId)).some(b => b.id === created.id)).toBe(true)
  })
})

describe('sitter booking flow', () => {
  let ctx: TestContext
  beforeEach(async () => { ctx = await createContext() })

  it('accepts, agrees times, and rejects early completion', async () => {
    const { sitterBookings, bookings } = ctx.services
    const booking = await bookings.create(ctx.bookerId, bookingRequest(3, 5))
    expect((await sitterBookings.accept(ctx.sitterId, booking.id)).status).toBe('accepted_times_pending')
    const confirmed = await sitterBookings.agreeTimes(ctx.sitterId, booking.id, { arrivalTime: '09:00', departureTime: '18:00' })
    expect(confirmed).toMatchObject({ status: 'confirmed', agreedArrivalTime: '09:00', agreedDepartureTime: '18:00' })
    await expect(sitterBookings.complete(ctx.sitterId, booking.id)).rejects.toThrow(InvalidTransitionError)
  })

  it('declines a request and frees the dates', async () => {
    const { sitterBookings, bookings } = ctx.services
    const booking = await bookings.create(ctx.bookerId, bookingRequest(3, 5))
    expect((await sitterBookings.decline(ctx.sitterId, booking.id, 'Away')).history.at(-1)?.message).toBe('Request declined: Away')
    await expect(bookings.create(ctx.bookerId, bookingRequest(3, 5))).resolves.toBeTruthy()
  })

  it('cannot agree times on a request that is not accepted', async () => {
    const booking = await ctx.services.bookings.create(ctx.bookerId, bookingRequest(3, 5))
    await expect(ctx.services.sitterBookings.agreeTimes(ctx.sitterId, booking.id, { arrivalTime: '09:00', departureTime: '18:00' }))
      .rejects.toThrow(InvalidTransitionError)
    expect((await ctx.services.bookings.get(ctx.bookerId, booking.id)).agreedArrivalTime).toBeNull()
  })

  it('manages availability blocks and refuses to cover live bookings', async () => {
    const { availabilityBlocks } = ctx.services
    const block = await availabilityBlocks.create(ctx.sitterId, { startDate: addDays(TODAY, 80), endDate: addDays(TODAY, 81), reason: 'Course' })
    expect((await availabilityBlocks.update(ctx.sitterId, block.id, { ...block, reason: 'Training' })).reason).toBe('Training')
    await availabilityBlocks.remove(ctx.sitterId, block.id)
    await expect(availabilityBlocks.remove(ctx.sitterId, block.id)).rejects.toThrow(NotFoundError)
    await expect(availabilityBlocks.create(ctx.sitterId, { startDate: addDays(TODAY, 24), endDate: addDays(TODAY, 24), reason: '' }))
      .rejects.toThrow(ConflictError)
  })
})
