import { bookingIdSchema } from '../../../../../../../shared/schemas/booking.ts'
import { progressUpdateSchema } from '../../../../../../../shared/schemas/sitter.ts'

export default defineApiHandler(async (event) => {
  const sitterId = await requireSitterId(event)
  const id = parseParam(event, 'id', bookingIdSchema)
  const input = await parseBody(event, progressUpdateSchema)
  const { sitterBookings } = await useServices()
  const update = await sitterBookings.addProgressUpdate(sitterId, id, input)
  setResponseStatus(event, 201)
  return update
})
