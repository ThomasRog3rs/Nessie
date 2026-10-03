import { bookingIdSchema } from '../../../../../shared/schemas/booking.ts'
import { PrivateFileStorage } from '../../../../storage/PrivateFileStorage.ts'

export default defineApiHandler(async (event) => {
  const bookingId = parseParam(event, 'id', bookingIdSchema)
  const attachmentId = parseParam(event, 'attachmentId', bookingIdSchema)
  const { bookings, actors } = await useServices()
  const { attachment, storageKey } = bookings.getAttachment(actors.bookerId(), bookingId, attachmentId)
  const contents = await new PrivateFileStorage().get(storageKey)
  const safeFileName = attachment.fileName.replace(/[^a-z0-9._-]/gi, '_').slice(0, 100) || 'attachment'
  setResponseHeader(event, 'Content-Type', attachment.mimeType)
  setResponseHeader(event, 'Content-Disposition', `inline; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  return send(event, contents, attachment.mimeType)
})
