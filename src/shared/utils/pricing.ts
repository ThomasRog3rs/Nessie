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
