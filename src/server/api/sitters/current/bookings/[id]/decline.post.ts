import { bookingIdSchema } from '../../../../../../shared/schemas/booking'
import { declineBookingSchema } from '../../../../../../shared/schemas/sitter'
import type { SitterBooking } from '../../../../../../shared/types/booking.ts'

export default defineApiHandler(async (event): Promise<SitterBooking> => {
  const id = parseParam(event, 'id', bookingIdSchema)
  const { reason } = await parseBody(event, declineBookingSchema.default({}))
  const { sitterBookings, actors } = await useServices()
  return sitterBookings.decline(actors.sitterId(), id, reason)
})
