export default defineApiHandler(async (event): Promise<LinkedBooker[]> => {
  const sitterId = await requireSitterId(event)
  const { accounts } = await useServices()
  return accounts.listLinkedBookers(sitterId)
})
