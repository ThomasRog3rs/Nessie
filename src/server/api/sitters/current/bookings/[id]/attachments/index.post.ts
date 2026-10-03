import { bookingIdSchema } from '../../../../../../../shared/schemas/booking.ts'
import { attachmentCaptionSchema } from '../../../../../../../shared/schemas/sitter.ts'
import type { BookingAttachment } from '../../../../../../../shared/types/booking.ts'
import { PrivateFileStorage } from '../../../../../../storage/PrivateFileStorage.ts'
import { readUpload } from '../../../../../../utils/uploads.ts'
import { parseValue } from '../../../../../../utils/http.ts'

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default defineApiHandler(async (event): Promise<BookingAttachment> => {
  const sitterId = await requireSitterId(event)
  const bookingId = parseParam(event, 'id', bookingIdSchema)
  const { fields, file } = await readUpload(event, PHOTO_TYPES)
  const { caption } = parseValue(attachmentCaptionSchema, { caption: fields.get('caption') })
  const storage = new PrivateFileStorage()
  const storageKey = await storage.put(file.contents)
  try {
    const { sitterBookings } = await useServices()
    const attachment = sitterBookings.addAttachment(sitterId, bookingId, {
      id: crypto.randomUUID(),
      bookingId,
      kind: 'photo',
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.contents.length,
      ...(caption ? { caption } : {}),
      creatorId: sitterId,
      createdAt: new Date().toISOString(),
      storageKey,
    })
    setResponseStatus(event, 201)
    return attachment
  }
  catch (error) {
    try {
      await storage.remove(storageKey)
    }
    catch (cleanupError) {
      console.error('[uploads] failed to remove unreferenced photo', cleanupError)
    }
    throw error
  }
})
