import { createHash, randomBytes } from 'node:crypto'
import type {
  AccountState, BookerInvite, BookerProfile, BookerProfileInput, CreatedBookerInvite, InvitePreview,
  InviteStatus, LinkedBooker, SitterProfile, SitterProfileInput,
} from '../../shared/types/booking.ts'
import { ConflictError, ForbiddenError, GoneError, NotFoundError } from '../domain/errors.ts'
import type { AccountRepository, TransactionRunner } from '../repositories/contracts.ts'
import type { Clock, IdGenerator } from './ports.ts'
import type { SitterService } from './SitterService.ts'

const HOUR_MS = 60 * 60 * 1000

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function inviteStatus(invite: { expiresAt: string, disabledAt?: string, usedAt?: string }, now: string): InviteStatus {
  if (invite.usedAt) return 'used'
  if (invite.disabledAt) return 'disabled'
  return invite.expiresAt <= now ? 'expired' : 'active'
}

function rethrowDuplicate(error: unknown): never {
  if (error instanceof Error && /UNIQUE constraint/i.test(error.message)) {
    throw new ConflictError('An account with these details already exists')
  }
  throw error
}

export class AccountService {
  private readonly accounts: AccountRepository
  private readonly sitters: SitterService
  private readonly transactions: TransactionRunner
  private readonly clock: Clock
  private readonly ids: IdGenerator

  constructor(deps: {
    accounts: AccountRepository, sitters: SitterService, transactions: TransactionRunner, clock: Clock, ids: IdGenerator
  }) {
    this.accounts = deps.accounts
    this.sitters = deps.sitters
    this.transactions = deps.transactions
    this.clock = deps.clock
    this.ids = deps.ids
  }

  findSitterId(clerkUserId: string): Promise<string | undefined> {
    return this.accounts.findSitterIdByClerkUser(clerkUserId)
  }

  findBookerId(clerkUserId: string): Promise<string | undefined> {
    return this.accounts.findBookerIdByClerkUser(clerkUserId)
  }

  async isSitterSignupOpen(): Promise<boolean> {
    return (await this.accounts.countClaimedSitters()) === 0
  }

  async describe(clerkUserId: string | null): Promise<AccountState> {
    const role = !clerkUserId ? 'none'
      : await this.findSitterId(clerkUserId) ? 'sitter'
        : await this.findBookerId(clerkUserId) ? 'booker' : 'none'
    return { signedIn: clerkUserId !== null, role, sitterSignupOpen: await this.isSitterSignupOpen() }
  }

  async registerSitter(clerkUserId: string, email: string, input: SitterProfileInput): Promise<SitterProfile> {
    return this.transactions.run(async () => {
      await this.assertNoAccount(clerkUserId)
      if (!await this.isSitterSignupOpen()) throw new ForbiddenError('Sitter sign-up is closed')
      let sitterId = await this.accounts.findUnclaimedSitterId()
      try {
        if (sitterId) await this.accounts.claimSitter(sitterId, clerkUserId, email)
        else {
          sitterId = this.ids.next()
          await this.accounts.insertSitter({ id: sitterId, clerkUserId, email, createdAt: this.clock.now().toISOString() })
        }
      }
      catch (error) {
        rethrowDuplicate(error)
      }
      const profile = { ...input, optionalServices: input.optionalServices.map(({ id: _id, ...service }) => service) }
      return this.sitters.updateCurrentProfile(sitterId, profile)
    })
  }

  async previewInvite(token: string): Promise<InvitePreview> {
    const invite = await this.accounts.findInviteByHash(hashInviteToken(token))
    if (!invite || inviteStatus(invite, this.clock.now().toISOString()) !== 'active') return { valid: false }
    return { valid: true, sitterName: invite.sitterName }
  }

  async registerBooker(clerkUserId: string, email: string, token: string, input: BookerProfileInput): Promise<BookerProfile> {
    return this.transactions.run(async () => {
      await this.assertNoAccount(clerkUserId)
      const now = this.clock.now().toISOString()
      const invite = await this.accounts.findInviteByHash(hashInviteToken(token))
      if (!invite || inviteStatus(invite, now) !== 'active') throw this.invalidInvite()
      const bookerId = this.ids.next()
      try {
        await this.accounts.insertBooker({ id: bookerId, clerkUserId, email, createdAt: now, profile: input })
      }
      catch (error) {
        rethrowDuplicate(error)
      }
      if (!await this.accounts.consumeInvite(invite.id, bookerId, now)) throw this.invalidInvite()
      await this.accounts.linkBookerToSitter(bookerId, invite.sitterId, now)
      return this.getBookerProfile(bookerId)
    })
  }

  async getBookerProfile(bookerId: string): Promise<BookerProfile> {
    const profile = await this.accounts.findBookerProfile(bookerId)
    if (!profile) throw new NotFoundError('Profile not found')
    return profile
  }

  async updateBookerProfile(bookerId: string, input: BookerProfileInput): Promise<BookerProfile> {
    return this.transactions.run(async () => {
      await this.getBookerProfile(bookerId)
      await this.accounts.updateBookerProfile(bookerId, input)
      return this.getBookerProfile(bookerId)
    })
  }

  async createInvite(sitterId: string, input: { label?: string | undefined, expiresInHours: number }): Promise<CreatedBookerInvite> {
    const now = this.clock.now()
    const token = randomBytes(32).toString('base64url')
    const id = this.ids.next()
    const createdAt = now.toISOString()
    const expiresAt = new Date(now.getTime() + input.expiresInHours * HOUR_MS).toISOString()
    const label = input.label ?? ''
    await this.accounts.insertInvite({ id, sitterId, tokenHash: hashInviteToken(token), label, createdAt, expiresAt })
    return { id, label, createdAt, expiresAt, status: 'active', token }
  }

  async listInvites(sitterId: string): Promise<BookerInvite[]> {
    const now = this.clock.now().toISOString()
    return (await this.accounts.listInvites(sitterId)).map(({ disabledAt, ...invite }) => ({
      ...invite,
      status: inviteStatus({ ...invite, ...(disabledAt ? { disabledAt } : {}) }, now),
    }))
  }

  async disableInvite(sitterId: string, inviteId: string): Promise<void> {
    const invite = (await this.accounts.listInvites(sitterId)).find(candidate => candidate.id === inviteId)
    if (!invite) throw new NotFoundError('Invite link not found')
    if (invite.usedAt) throw new ConflictError('This link has already been used')
    await this.accounts.disableInvite(sitterId, inviteId, this.clock.now().toISOString())
  }

  listLinkedBookers(sitterId: string): Promise<LinkedBooker[]> {
    return this.accounts.listBookersForSitter(sitterId)
  }

  private async assertNoAccount(clerkUserId: string): Promise<void> {
    if (await this.findSitterId(clerkUserId) || await this.findBookerId(clerkUserId)) {
      throw new ConflictError('This sign-in already has an account')
    }
  }

  private invalidInvite(): GoneError {
    return new GoneError('This invite link is no longer valid. Ask your sitter for a new one.')
  }
}
