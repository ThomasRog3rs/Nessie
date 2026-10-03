import type { SitterBooking } from '../../../../../shared/types/booking.ts'

export default defineApiHandler(async (event): Promise<SitterBooking[]> => {
  const sitterId = await requireSitterId(event)
  const { sitterBookings } = await useServices()
  return sitterBookings.list(sitterId)
})
