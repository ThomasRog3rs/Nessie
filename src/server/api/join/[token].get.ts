import { inviteTokenSchema } from '../../../shared/schemas/account'

export default defineApiHandler(async (event): Promise<InvitePreview> => {
  const token = parseParam(event, 'token', inviteTokenSchema)
  const { accounts } = await useServices()
  return accounts.previewInvite(token)
})
