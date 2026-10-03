import { beforeEach, describe, expect, it } from 'vitest'
import { addDays } from '../shared/utils/dateRange.ts'
import { createContext, TODAY } from './helpers.ts'
import type { TestContext } from './helpers.ts'

describe('availability', () => {
  let ctx: TestContext
  beforeEach(async () => { ctx = await createContext() })

  const statusOn = (offset: number) =>
    ctx.services.availability.getDays(ctx.sitterId, addDays(TODAY, offset), addDays(TODAY, offset))[0]!.status

  it('marks blocked, booked and untouched dates', () => {
    expect(statusOn(12)).toBe('unavailable') // annual leave +10..+16
    expect(statusOn(23)).toBe('booked') // confirmed +22..+26
    expect(statusOn(5)).toBe('available')
  })

  it('leaves the departure day free', () => {
    expect(statusOn(26)).toBe('available')
  })

  it('does not hold dates for cancelled, declined or completed bookings', () => {
    expect(statusOn(46)).toBe('available') // cancelled +45..+48
    expect(statusOn(71)).toBe('available') // declined +70..+72
    expect(statusOn(-18)).toBe('available') // completed
  })

  it('limits the queried range', () => {
    expect(() => ctx.services.availability.getDays(ctx.sitterId, TODAY, addDays(TODAY, 400))).toThrow(/at most/)
  })
})
