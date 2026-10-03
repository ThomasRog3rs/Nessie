// Temporary in-memory stand-in for the real persistence layer. Replace with the real backend.
export const MOCK_SITTER: Sitter = {
  id: 'sitter-mock-1',
  name: 'Alex Morgan',
  bio: 'Experienced house and pet sitter. Comfortable with dogs, cats and small animals, and happy to keep plants and post in order.',
  rate: 4500,
  rateBasis: 'per_night',
  currency: 'GBP',
  timezone: 'Europe/London',
  acceptedPets: ['Dog', 'Cat', 'Small animal', 'Bird', 'Fish'],
  optionalServices: [
    { id: 'svc-walks', name: 'Extra dog walk', description: 'One additional 30 minute walk per day', price: 800 },
    { id: 'svc-plants', name: 'Plant watering', description: 'Indoor and garden plants', price: 500 },
    { id: 'svc-meds', name: 'Medication administration', description: 'Per day, as instructed', price: 600 },
  ],
}

export const bookings = new Map<string, Booking>()

export const ACTIVE_STATUSES: BookingStatus[] = ['requested', 'accepted_times_pending', 'confirmed']

export function overlaps(a: { startDate: string, endDate: string }, b: { startDate: string, endDate: string }) {
  return a.startDate < b.endDate && b.startDate < a.endDate
}
