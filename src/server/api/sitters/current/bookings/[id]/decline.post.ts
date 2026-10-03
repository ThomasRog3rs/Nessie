import { bookingIdSchema } from '../../../../../../shared/schemas/booking'
import { declineBookingSchema } from '../../../../../../shared/schemas/sitter'

export default defineApiHandler(async (event): Promise<Booking> => {
  const id = parseParam(event, 'id', bookingIdSchema)
  const { reason } = await parseBody(event, declineBookingSchema.default({}))
  const { sitterBookings, actors } = await useServices()
  return sitterBookings.decline(actors.sitterId(), id, reason)
})
