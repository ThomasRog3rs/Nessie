import { bookingIdSchema } from '../../../../../../shared/schemas/booking.ts'
import type { SitterBooking } from '../../../../../../shared/types/booking.ts'

export default defineApiHandler(async (event): Promise<SitterBooking> => {
  const sitterId = await requireSitterId(event)
  const id = parseParam(event, 'id', bookingIdSchema)
  const { sitterBookings } = await useServices()
  return sitterBookings.get(sitterId, id)
})
