import type { H3Event } from 'h3'
import { clerkClient } from '@clerk/nuxt/server'
import { ForbiddenError, UnauthorizedError } from '../domain/errors.ts'

export function optionalClerkUserId(event: H3Event): string | null {
  return event.context.auth().userId ?? null
}

export function requireClerkUserId(event: H3Event): string {
  const userId = optionalClerkUserId(event)
  if (!userId) throw new UnauthorizedError('Sign in to continue')
  return userId
}

export async function requireSitterId(event: H3Event): Promise<string> {
  const userId = requireClerkUserId(event)
  const { accounts } = await useServices()
  const sitterId = accounts.findSitterId(userId)
  if (!sitterId) throw new ForbiddenError('This area is for the sitter')
  return sitterId
}

export async function requireBookerId(event: H3Event): Promise<string> {
  const userId = requireClerkUserId(event)
  const { accounts } = await useServices()
  const bookerId = accounts.findBookerId(userId)
  if (!bookerId) throw new ForbiddenError('Join through a link from your sitter to book')
  return bookerId
}

/** The verified primary email of the signed-in Clerk user. */
export async function clerkEmail(event: H3Event, userId: string): Promise<string> {
  const user = await clerkClient(event as Parameters<typeof clerkClient>[0]).users.getUser(userId)
  const primary = user.emailAddresses.find(address => address.id === user.primaryEmailAddressId) ?? user.emailAddresses[0]
  if (!primary) throw new ForbiddenError('Your account needs an email address')
  return primary.emailAddress
}
