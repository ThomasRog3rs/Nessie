import { bookingRequestSchema } from '../../../shared/schemas/booking'

export default defineApiHandler(async (event): Promise<Booking> => {
  const request = await parseBody(event, bookingRequestSchema)
  const { bookings, actors } = await useServices()
  const booking = bookings.create(actors.bookerId(), request)
  setResponseStatus(event, 201)
  return booking
})
