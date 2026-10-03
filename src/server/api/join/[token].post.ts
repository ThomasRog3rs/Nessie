import { GoneError } from '../../domain/errors.ts'
import { bookerProfileInputSchema, inviteTokenSchema } from '../../../shared/schemas/account'

export default defineApiHandler(async (event): Promise<BookerProfile> => {
  const userId = requireClerkUserId(event)
  const token = parseParam(event, 'token', inviteTokenSchema)
  const input = await parseBody(event, bookerProfileInputSchema)
  const { accounts } = await useServices()
  if (!(await accounts.previewInvite(token)).valid) throw new GoneError('This invite link is no longer valid. Ask your sitter for a new one.')
  const profile = await accounts.registerBooker(userId, await clerkEmail(event, userId), token, input)
  setResponseStatus(event, 201)
  return profile
})
