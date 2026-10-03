import { availabilityBlockInputSchema } from '../../../../../shared/schemas/sitter'

export default defineApiHandler(async (event): Promise<AvailabilityBlock> => {
  const sitterId = await requireSitterId(event)
  const input = await parseBody(event, availabilityBlockInputSchema)
  const { availabilityBlocks } = await useServices()
  const block = availabilityBlocks.create(sitterId, input)
  setResponseStatus(event, 201)
  return block
})
