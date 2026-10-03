import { bookingRequestSchema } from '../../../shared/schemas/booking'

export default defineApiHandler(async (event): Promise<Booking> => {
  const bookerId = await requireBookerId(event)
  const request = await parseBody(event, bookingRequestSchema)
  const { bookings } = await useServices()
  const booking = bookings.create(bookerId, request)
  setResponseStatus(event, 201)
  return booking
})
