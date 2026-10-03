import { bookingIdSchema } from '../../../../../../../shared/schemas/booking.ts'
import { sitterExpenseSchema } from '../../../../../../../shared/schemas/sitter.ts'
import type { BookingAttachment } from '../../../../../../../shared/types/booking.ts'
import { PrivateFileStorage } from '../../../../../../storage/PrivateFileStorage.ts'
import { parseValue } from '../../../../../../utils/http.ts'
import { readMultipartUpload } from '../../../../../../utils/uploads.ts'

const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export default defineApiHandler(async (event) => {
  const sitterId = await requireSitterId(event)
  const id = parseParam(event, 'id', bookingIdSchema)
  const { fields, file } = await readMultipartUpload(event, RECEIPT_TYPES)
  const input = parseValue(sitterExpenseSchema, {
    category: fields.get('category'),
    description: fields.get('description'),
    amount: Number(fields.get('amount')),
  })
  const storage = new PrivateFileStorage()
  const storageKey = file ? await storage.put(file.contents) : undefined
  try {
    const { sitterBookings } = await useServices()
    const receipt: (BookingAttachment & { storageKey: string }) | undefined = file && storageKey
      ? {
          id: crypto.randomUUID(),
          bookingId: id,
          kind: 'receipt',
          fileName: file.fileName,
          mimeType: file.mimeType,
          size: file.contents.length,
          creatorId: sitterId,
          createdAt: new Date().toISOString(),
          storageKey,
        }
      : undefined
    const expense = sitterBookings.addExpense(sitterId, id, input, receipt)
    setResponseStatus(event, 201)
    return expense
  }
  catch (error) {
    if (storageKey) {
      try {
        await storage.remove(storageKey)
      }
      catch (cleanupError) {
        console.error('[uploads] failed to remove unreferenced receipt', cleanupError)
      }
    }
    throw error
  }
})
