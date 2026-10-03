import { bookingIdSchema } from '../../../../../../shared/schemas/booking'
import type { SitterBooking } from '../../../../../../shared/types/booking.ts'

export default defineApiHandler(async (event): Promise<SitterBooking> => {
  const id = parseParam(event, 'id', bookingIdSchema)
  const { sitterBookings, actors } = await useServices()
  return sitterBookings.complete(actors.sitterId(), id)
})
