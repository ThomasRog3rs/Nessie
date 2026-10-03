import type { SitterProfile } from '../../../../shared/types/booking.ts'

export default defineApiHandler(async (event): Promise<SitterProfile> => {
  const sitterId = await requireSitterId(event)
  const { sitters } = await useServices()
  return sitters.getCurrentProfile(sitterId)
})
