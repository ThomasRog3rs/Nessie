export default defineEventHandler(async (event): Promise<Booking> => {
  const booking = bookings.get(getRouterParam(event, 'id') ?? '')
  if (!booking) throw createError({ statusCode: 404, statusMessage: 'Booking not found' })
  if (!ACTIVE_STATUSES.includes(booking.status)) {
    throw createError({ statusCode: 409, statusMessage: 'This booking can no longer be cancelled' })
  }
  const { reason } = (await readBody<CancelBookingRequest | undefined>(event)) ?? {}
  booking.status = 'cancelled'
  booking.history.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    type: 'cancelled',
    actor: 'booker',
    message: reason?.trim() ? `Cancelled by the booker: ${reason.trim()}` : 'Cancelled by the booker.',
  })
  return booking
})
