import { bookingIdSchema } from '../../../../../../../shared/schemas/booking.ts'
import { progressUpdateSchema } from '../../../../../../../shared/schemas/sitter.ts'

export default defineApiHandler(async (event) => {
  const id = parseParam(event, 'id', bookingIdSchema)
  const input = await parseBody(event, progressUpdateSchema)
  const { sitterBookings, actors } = await useServices()
  const update = sitterBookings.addProgressUpdate(actors.sitterId(), id, input)
  setResponseStatus(event, 201)
  return update
})
