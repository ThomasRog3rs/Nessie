import { bookingIdSchema, cancelBookingSchema } from '../../../../../../shared/schemas/booking'
import type { SitterBooking } from '../../../../../../shared/types/booking.ts'

export default defineApiHandler(async (event): Promise<SitterBooking> => {
  const sitterId = await requireSitterId(event)
  const id = parseParam(event, 'id', bookingIdSchema)
  const { reason } = await parseBody(event, cancelBookingSchema.default({}))
  const { sitterBookings } = await useServices()
  return sitterBookings.cancel(sitterId, id, reason)
})
