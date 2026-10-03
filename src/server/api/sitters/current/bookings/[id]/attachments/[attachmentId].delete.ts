import { bookingIdSchema } from '../../../../../../../shared/schemas/booking.ts'
import { PrivateFileStorage } from '../../../../../../storage/PrivateFileStorage.ts'

export default defineApiHandler(async (event) => {
  const sitterId = await requireSitterId(event)
  const bookingId = parseParam(event, 'id', bookingIdSchema)
  const attachmentId = parseParam(event, 'attachmentId', bookingIdSchema)
  const { sitterBookings } = await useServices()
  const { storageKey } = sitterBookings.removeAttachment(sitterId, bookingId, attachmentId)
  await new PrivateFileStorage().remove(storageKey)
  setResponseStatus(event, 204)
})
