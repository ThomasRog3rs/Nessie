import { availabilityBlockInputSchema } from '../../../../../shared/schemas/sitter'

export default defineApiHandler(async (event): Promise<AvailabilityBlock> => {
  const input = await parseBody(event, availabilityBlockInputSchema)
  const { availabilityBlocks, actors } = await useServices()
  const block = availabilityBlocks.create(actors.sitterId(), input)
  setResponseStatus(event, 201)
  return block
})
