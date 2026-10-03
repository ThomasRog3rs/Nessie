import { beforeEach, describe, expect, it } from 'vitest'
import { addDays } from '../shared/utils/dateRange.ts'
import { createContext, TODAY } from './helpers.ts'
import type { TestContext } from './helpers.ts'

describe('availability', () => {
  let ctx: TestContext
  beforeEach(async () => { ctx = await createContext() })

  const statusOn = async (offset: number) =>
    (await ctx.services.availability.getDays(ctx.sitterId, addDays(TODAY, offset), addDays(TODAY, offset)))[0]!.status

  it('marks blocked, booked and untouched dates', async () => {
    expect(await statusOn(12)).toBe('unavailable')
    expect(await statusOn(23)).toBe('booked')
    expect(await statusOn(5)).toBe('available')
  })

  it('leaves the departure day free', async () => {
    expect(await statusOn(26)).toBe('available')
  })

  it('does not hold dates for cancelled, declined or completed bookings', async () => {
    expect(await statusOn(46)).toBe('available')
    expect(await statusOn(71)).toBe('available')
    expect(await statusOn(-18)).toBe('available')
  })

  it('limits the queried range', async () => {
    await expect(ctx.services.availability.getDays(ctx.sitterId, TODAY, addDays(TODAY, 400))).rejects.toThrow(/at most/)
  })
})
