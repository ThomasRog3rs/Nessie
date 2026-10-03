export default defineEventHandler((event): Booking => {
  const booking = bookings.get(getRouterParam(event, 'id') ?? '')
  if (!booking) throw createError({ statusCode: 404, statusMessage: 'Booking not found' })
  return booking
})
