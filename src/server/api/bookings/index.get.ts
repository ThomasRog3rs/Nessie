export default defineEventHandler((): Booking[] =>
  [...bookings.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
