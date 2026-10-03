import { bookingIdSchema } from '../../../../../shared/schemas/booking'
import { availabilityBlockInputSchema } from '../../../../../shared/schemas/sitter'

export default defineApiHandler(async (event): Promise<AvailabilityBlock> => {
  const sitterId = await requireSitterId(event)
  const id = parseParam(event, 'id', bookingIdSchema)
  const input = await parseBody(event, availabilityBlockInputSchema)
  const { availabilityBlocks } = await useServices()
  return availabilityBlocks.update(sitterId, id, input)
})
