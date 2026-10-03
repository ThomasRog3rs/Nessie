import { bookingIdSchema } from '../../../../../../shared/schemas/booking'
import { agreeTimesSchema } from '../../../../../../shared/schemas/sitter'
import type { SitterBooking } from '../../../../../../shared/types/booking.ts'

export default defineApiHandler(async (event): Promise<SitterBooking> => {
  const sitterId = await requireSitterId(event)
  const id = parseParam(event, 'id', bookingIdSchema)
  const times = await parseBody(event, agreeTimesSchema)
  const { sitterBookings } = await useServices()
  return sitterBookings.agreeTimes(sitterId, id, times)
})
