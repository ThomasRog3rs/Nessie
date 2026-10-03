import { bookingIdSchema } from '../../../../../../shared/schemas/booking'

export default defineApiHandler(async (event) => {
  const sitterId = await requireSitterId(event)
  const id = parseParam(event, 'id', bookingIdSchema)
  const { accounts } = await useServices()
  accounts.disableInvite(sitterId, id)
  setResponseStatus(event, 204)
  return null
})
