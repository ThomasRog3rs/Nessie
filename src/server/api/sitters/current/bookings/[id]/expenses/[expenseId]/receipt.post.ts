import { bookingIdSchema } from '../../../../../../../../shared/schemas/booking.ts'
import type { BookingAttachment } from '../../../../../../../../shared/types/booking.ts'
import { PrivateFileStorage } from '../../../../../../../storage/PrivateFileStorage.ts'
import { readUpload } from '../../../../../../../utils/uploads.ts'

const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export default defineApiHandler(async (event): Promise<BookingAttachment> => {
  const sitterId = await requireSitterId(event)
  const bookingId = parseParam(event, 'id', bookingIdSchema)
  const expenseId = parseParam(event, 'expenseId', bookingIdSchema)
  const { file } = await readUpload(event, RECEIPT_TYPES)
  const storage = new PrivateFileStorage()
  const storageKey = await storage.put(file.contents)
  try {
    const { sitterBookings } = await useServices()
    const attachment = sitterBookings.addAttachment(sitterId, bookingId, {
      id: crypto.randomUUID(),
      bookingId,
      expenseId,
      kind: 'receipt',
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.contents.length,
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
      console.error('[uploads] failed to remove unreferenced receipt', cleanupError)
    }
    throw error
  }
})
