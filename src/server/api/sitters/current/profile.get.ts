import type { SitterProfile } from '../../../../shared/types/booking.ts'

export default defineApiHandler(async (): Promise<SitterProfile> => {
  const { sitters, actors } = await useServices()
  return sitters.getCurrentProfile(actors.sitterId())
})
