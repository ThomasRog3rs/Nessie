import { describe, expect, it } from 'vitest'
import { calculateActualCosts, calculatePricing } from '../shared/utils/pricing.ts'

describe('calculatePricing', () => {
  it('prices services per night and keeps travel and incidentals separate', () => {
    expect(calculatePricing({
      nights: 3, rate: 4500, services: [{ price: 800 }], travelAmount: 3400, incidentalExpenses: [{ amount: 250 }],
    })).toEqual({ nights: 3, sitting: 13500, services: 2400, travel: 3400, incidentals: 250, total: 19550 })
  })
})

describe('calculateActualCosts', () => {
  it('replaces proposed travel and incidentals with recorded expenses', () => {
    const pricing = { nights: 3, sitting: 13500, services: 2400, travel: 3400, incidentals: 250, total: 19550 }
    expect(calculateActualCosts(pricing, [
      { category: 'travel', amount: 2800 }, { category: 'incidental', amount: 100 }, { category: 'incidental', amount: 450 },
    ])).toEqual({ sitting: 13500, services: 2400, travel: 2800, incidentals: 550, total: 19250 })
    expect(calculateActualCosts(pricing, []).total).toBe(15900)
  })
})
