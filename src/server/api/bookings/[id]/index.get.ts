import { bookingIdSchema } from '../../../../shared/schemas/booking'

export default defineApiHandler(async (event): Promise<Booking> => {
  const id = parseParam(event, 'id', bookingIdSchema)
  const { bookings, actors } = await useServices()
  return bookings.get(actors.bookerId(), id)
})
