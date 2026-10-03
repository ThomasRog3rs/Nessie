import { bookingIdSchema } from '../../../../../shared/schemas/booking'
import { availabilityBlockInputSchema } from '../../../../../shared/schemas/sitter'

export default defineApiHandler(async (event): Promise<AvailabilityBlock> => {
  const id = parseParam(event, 'id', bookingIdSchema)
  const input = await parseBody(event, availabilityBlockInputSchema)
  const { availabilityBlocks, actors } = await useServices()
  return availabilityBlocks.update(actors.sitterId(), id, input)
})
