import { bookingIdSchema } from '../../../../../shared/schemas/booking'

export default defineApiHandler(async (event) => {
  const id = parseParam(event, 'id', bookingIdSchema)
  const { availabilityBlocks, actors } = await useServices()
  availabilityBlocks.remove(actors.sitterId(), id)
  setResponseStatus(event, 204)
  return null
})
