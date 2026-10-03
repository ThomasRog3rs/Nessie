/** Pure pricing rules shared by the review UI and the server so totals never drift. */
export interface PricingInput {
  nights: number
  rate: Money
  services: ReadonlyArray<{ price: Money }>
  travelAmount: Money
  incidentalExpenses: ReadonlyArray<{ amount: Money }>
}

export function calculatePricing(input: PricingInput): BookingPricing {
  const sitting = input.nights * input.rate
  const services = input.services.reduce((sum, service) => sum + service.price * input.nights, 0)
  const incidentals = input.incidentalExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  return {
    nights: input.nights,
    sitting,
    services,
    travel: input.travelAmount,
    incidentals,
    total: sitting + services + input.travelAmount + incidentals,
  }
}

export interface ActualCosts {
  sitting: Money
  services: Money
  travel: Money
  incidentals: Money
  total: Money
}

/** Actual costs: the agreed sitting and services plus what the sitter really recorded, replacing the proposed travel and incidentals. */
export function calculateActualCosts(pricing: BookingPricing, expenses: ReadonlyArray<{ category: 'travel' | 'incidental', amount: Money }>): ActualCosts {
  const travel = expenses.filter(e => e.category === 'travel').reduce((sum, e) => sum + e.amount, 0)
  const incidentals = expenses.filter(e => e.category === 'incidental').reduce((sum, e) => sum + e.amount, 0)
  return {
    sitting: pricing.sitting,
    services: pricing.services,
    travel,
    incidentals,
    total: pricing.sitting + pricing.services + travel + incidentals,
  }
}
