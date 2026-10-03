import { bookingIdSchema } from '../../../../../../shared/schemas/booking'

export default defineApiHandler(async (event): Promise<Booking> => {
  const id = parseParam(event, 'id', bookingIdSchema)
  const { sitterBookings, actors } = await useServices()
  return sitterBookings.complete(actors.sitterId(), id)
})
