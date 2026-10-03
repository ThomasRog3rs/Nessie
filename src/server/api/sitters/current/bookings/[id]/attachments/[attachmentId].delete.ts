import { bookingIdSchema } from '../../../../../../../shared/schemas/booking.ts'
import { createPrivateStorage } from '../../../../../../storage/index.ts'

export default defineApiHandler(async (event) => {
  const sitterId = await requireSitterId(event)
  const bookingId = parseParam(event, 'id', bookingIdSchema)
  const attachmentId = parseParam(event, 'attachmentId', bookingIdSchema)
  const { sitterBookings } = await useServices()
  const { storageKey } = await sitterBookings.removeAttachment(sitterId, bookingId, attachmentId)
  await createPrivateStorage().remove(storageKey)
  setResponseStatus(event, 204)
})
