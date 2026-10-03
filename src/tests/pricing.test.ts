import { describe, expect, it } from 'vitest'
import { calculatePricing } from '../shared/utils/pricing.ts'

describe('calculatePricing', () => {
  it('prices services per night and keeps travel and incidentals separate', () => {
    expect(calculatePricing({
      nights: 3, rate: 4500, services: [{ price: 800 }], travelAmount: 3400, incidentalExpenses: [{ amount: 250 }],
    })).toEqual({ nights: 3, sitting: 13500, services: 2400, travel: 3400, incidentals: 250, total: 19550 })
  })
})
