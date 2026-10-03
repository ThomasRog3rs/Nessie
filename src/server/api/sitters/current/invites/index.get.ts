export default defineApiHandler(async (event): Promise<BookerInvite[]> => {
  const sitterId = await requireSitterId(event)
  const { accounts } = await useServices()
  return accounts.listInvites(sitterId)
})
