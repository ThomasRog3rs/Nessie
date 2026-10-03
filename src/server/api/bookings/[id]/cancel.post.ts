import { bookingIdSchema, cancelBookingSchema } from '../../../../shared/schemas/booking'

export default defineApiHandler(async (event): Promise<Booking> => {
  const id = parseParam(event, 'id', bookingIdSchema)
  const { reason } = await parseBody(event, cancelBookingSchema.default({}))
  const { bookings, actors } = await useServices()
  return bookings.cancel(actors.bookerId(), id, reason)
})
