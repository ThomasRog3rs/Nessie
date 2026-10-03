export default defineApiHandler(async (event): Promise<AccountState> => {
  const { accounts } = await useServices()
  return accounts.describe(optionalClerkUserId(event))
})
