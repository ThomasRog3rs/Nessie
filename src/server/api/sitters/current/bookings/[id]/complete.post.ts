import { bookingIdSchema } from '../../../../../../shared/schemas/booking'
import type { SitterBooking } from '../../../../../../shared/types/booking.ts'

export default defineApiHandler(async (event): Promise<SitterBooking> => {
  const sitterId = await requireSitterId(event)
  const id = parseParam(event, 'id', bookingIdSchema)
  const { sitterBookings } = await useServices()
  return sitterBookings.complete(sitterId, id)
})
