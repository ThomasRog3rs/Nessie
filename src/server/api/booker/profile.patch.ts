import { bookerProfileInputSchema } from '../../../shared/schemas/account'

export default defineApiHandler(async (event): Promise<BookerProfile> => {
  const bookerId = await requireBookerId(event)
  const input = await parseBody(event, bookerProfileInputSchema)
  const { accounts } = await useServices()
  return accounts.updateBookerProfile(bookerId, input)
})
