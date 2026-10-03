export default defineApiHandler(async (event): Promise<BookerProfile> => {
  const bookerId = await requireBookerId(event)
  const { accounts } = await useServices()
  return accounts.getBookerProfile(bookerId)
})
