import { sitterProfileInputSchema } from '../../../../shared/schemas/sitter.ts'
import type { SitterProfile } from '../../../../shared/types/booking.ts'

export default defineApiHandler(async (event): Promise<SitterProfile> => {
  const sitterId = await requireSitterId(event)
  const input = await parseBody(event, sitterProfileInputSchema)
  const { sitters } = await useServices()
  return sitters.updateCurrentProfile(sitterId, input)
})
