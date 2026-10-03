import type { SitterBooking } from '../../../../../shared/types/booking.ts'

export default defineApiHandler(async (): Promise<SitterBooking[]> => {
  const { sitterBookings, actors } = await useServices()
  return sitterBookings.list(actors.sitterId())
})
