import { ForbiddenError } from '../../domain/errors.ts'
import { sitterProfileInputSchema } from '../../../shared/schemas/sitter'

export default defineApiHandler(async (event): Promise<SitterProfile> => {
  const userId = requireClerkUserId(event)
  const input = await parseBody(event, sitterProfileInputSchema)
  const { accounts } = await useServices()
  if (!await accounts.isSitterSignupOpen()) throw new ForbiddenError('Sitter sign-up is closed')
  const profile = await accounts.registerSitter(userId, await clerkEmail(event, userId), input)
  setResponseStatus(event, 201)
  return profile
})
