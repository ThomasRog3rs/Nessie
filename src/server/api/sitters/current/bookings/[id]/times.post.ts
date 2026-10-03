import { bookingIdSchema } from '../../../../../../shared/schemas/booking'
import { agreeTimesSchema } from '../../../../../../shared/schemas/sitter'

export default defineApiHandler(async (event): Promise<Booking> => {
  const id = parseParam(event, 'id', bookingIdSchema)
  const times = await parseBody(event, agreeTimesSchema)
  const { sitterBookings, actors } = await useServices()
  return sitterBookings.agreeTimes(actors.sitterId(), id, times)
})
