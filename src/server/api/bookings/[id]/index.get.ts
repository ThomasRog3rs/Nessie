import { bookingIdSchema } from '../../../../shared/schemas/booking'

export default defineApiHandler(async (event): Promise<BookerBooking> => {
  const bookerId = await requireBookerId(event)
  const id = parseParam(event, 'id', bookingIdSchema)
  const { bookings } = await useServices()
  return bookings.get(bookerId, id)
})
