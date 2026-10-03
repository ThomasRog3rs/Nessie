import { bookingIdSchema } from '../../../../../../shared/schemas/booking'
import { agreeTimesSchema } from '../../../../../../shared/schemas/sitter'
import type { SitterBooking } from '../../../../../../shared/types/booking.ts'

export default defineApiHandler(async (event): Promise<SitterBooking> => {
  const id = parseParam(event, 'id', bookingIdSchema)
  const times = await parseBody(event, agreeTimesSchema)
  const { sitterBookings, actors } = await useServices()
  return sitterBookings.agreeTimes(actors.sitterId(), id, times)
})
