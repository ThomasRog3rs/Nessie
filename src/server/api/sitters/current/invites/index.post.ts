import { createInviteSchema } from '../../../../../shared/schemas/account'

export default defineApiHandler(async (event): Promise<CreatedBookerInvite> => {
  const sitterId = await requireSitterId(event)
  const input = await parseBody(event, createInviteSchema)
  const { accounts } = await useServices()
  const invite = accounts.createInvite(sitterId, input)
  setResponseStatus(event, 201)
  return invite
})
