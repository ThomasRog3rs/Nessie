import { bookingIdSchema } from '../../../../../shared/schemas/booking'

export default defineApiHandler(async (event) => {
  const sitterId = await requireSitterId(event)
  const id = parseParam(event, 'id', bookingIdSchema)
  const { availabilityBlocks } = await useServices()
  availabilityBlocks.remove(sitterId, id)
  setResponseStatus(event, 204)
  return null
})
