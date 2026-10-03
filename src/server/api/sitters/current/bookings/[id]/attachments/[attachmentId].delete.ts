import { bookingIdSchema } from '../../../../../../../shared/schemas/booking.ts'
import { PrivateFileStorage } from '../../../../../../storage/PrivateFileStorage.ts'

export default defineApiHandler(async (event) => {
  const bookingId = parseParam(event, 'id', bookingIdSchema)
  const attachmentId = parseParam(event, 'attachmentId', bookingIdSchema)
  const { sitterBookings, actors } = await useServices()
  const { storageKey } = sitterBookings.removeAttachment(actors.sitterId(), bookingId, attachmentId)
  await new PrivateFileStorage().remove(storageKey)
  setResponseStatus(event, 204)
})
