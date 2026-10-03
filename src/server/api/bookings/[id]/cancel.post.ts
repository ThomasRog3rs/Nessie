import { bookingIdSchema, cancelBookingSchema } from '../../../../shared/schemas/booking'

export default defineApiHandler(async (event): Promise<Booking> => {
  const bookerId = await requireBookerId(event)
  const id = parseParam(event, 'id', bookingIdSchema)
  const { reason } = await parseBody(event, cancelBookingSchema.default({}))
  const { bookings } = await useServices()
  return bookings.cancel(bookerId, id, reason)
})
