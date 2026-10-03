import { sitterProfileInputSchema } from '../../../../shared/schemas/sitter.ts'
import type { SitterProfile } from '../../../../shared/types/booking.ts'

export default defineApiHandler(async (event): Promise<SitterProfile> => {
  const input = await parseBody(event, sitterProfileInputSchema)
  const { sitters, actors } = await useServices()
  return sitters.updateCurrentProfile(actors.sitterId(), input)
})
