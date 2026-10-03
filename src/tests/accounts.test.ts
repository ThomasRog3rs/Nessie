import { describe, expect, it } from 'vitest'
import { ConflictError, ForbiddenError, GoneError } from '../server/domain/errors.ts'
import { getRow, openDatabase } from '../server/db/connection.ts'
import { createServices } from '../server/services/composition.ts'
import type { BookerProfileInput, SitterProfileInput } from '../shared/types/booking.ts'
import { createMigratedDatabase } from './helpers.ts'

const sitterInput: SitterProfileInput = {
  name: 'Sitter One', location: 'Bristol', bio: 'Hi', phone: '07700 900001', rate: 4500, rateBasis: 'per_night',
  acceptedPets: ['Dog'], optionalServices: [{ name: 'Plants', price: 500 }],
}
const bookerInput: BookerProfileInput = {
  name: 'Booker One', phone: '07700 900002', addressLine: '1 High St', city: 'Bath', postcode: 'BA1 1AA',
  emergencyContact: { name: 'Sam', phone: '07700 900003', relationship: 'Friend' },
  vet: { name: 'Vets', phone: '01632 960001' }, emergencyInstructions: '', propertyInstructions: '',
  pets: [{ name: 'Rex', species: 'Dog', notes: 'Walk twice' }],
}

async function setup() {
  const db = await createMigratedDatabase()
  let now = new Date('2030-01-01T12:00:00Z')
  const services = createServices(db, { clock: { now: () => now } })
  return { db, services, advance: (hours: number) => { now = new Date(now.getTime() + hours * 3_600_000) } }
}

describe('sitter sign-up', () => {
  it('is open until one sitter exists, then closes for everyone else', async () => {
    const { services } = await setup()
    expect(await services.accounts.isSitterSignupOpen()).toBe(true)
    await services.accounts.registerSitter('user_a', 'a@example.com', sitterInput)
    expect(await services.accounts.isSitterSignupOpen()).toBe(false)
    expect((await services.accounts.describe('user_a')).role).toBe('sitter')
    await expect(services.accounts.registerSitter('user_b', 'b@example.com', sitterInput)).rejects.toThrow(ForbiddenError)
  })

  it('refuses to register the same sign-in twice', async () => {
    const { services } = await setup()
    await services.accounts.registerSitter('user_a', 'a@example.com', sitterInput)
    await expect(services.accounts.registerSitter('user_a', 'a@example.com', sitterInput)).rejects.toThrow(ConflictError)
  })

  it('enforces a single sitter in the database itself', async () => {
    const db = await openDatabase('file::memory:')
    const { Migrator } = await import('../server/db/migrator.ts')
    const { migrationSource } = await import('./helpers.ts')
    await new Migrator(db, migrationSource).migrate()
    await db.execute({ sql: `INSERT INTO sitters (id, name, email, bio, rate_pence, rate_basis, timezone, created_at)
      VALUES (?, 'n', ?, '', 0, 'per_night', 'Europe/London', 'now')`, args: ['s1', 's1@example.com'] })
    await expect(db.execute({ sql: `INSERT INTO sitters (id, name, email, bio, rate_pence, rate_basis, timezone, created_at)
      VALUES (?, 'n', ?, '', 0, 'per_night', 'Europe/London', 'now')`, args: ['s2', 's2@example.com'] })).rejects.toThrow()
  })
})

describe('booker invite links', () => {
  it('lets a booker join once, links them to the inviting sitter and then burns the link', async () => {
    const { services } = await setup()
    await services.accounts.registerSitter('user_s', 's@example.com', sitterInput)
    const sitterId = (await services.accounts.findSitterId('user_s'))!
    const invite = await services.accounts.createInvite(sitterId, { label: 'Gran', expiresInHours: 24 })

    expect(await services.accounts.previewInvite(invite.token)).toEqual({ valid: true, sitterName: 'Sitter One' })
    const profile = await services.accounts.registerBooker('user_b', 'b@example.com', invite.token, bookerInput)
    expect(profile).toMatchObject({ email: 'b@example.com', pets: [{ name: 'Rex' }], addressLine: '1 High St' })

    const bookerId = (await services.accounts.findBookerId('user_b'))!
    expect((await services.sitters.getPreferredSitter(bookerId)).id).toBe(sitterId)
    expect(await services.accounts.listLinkedBookers(sitterId)).toMatchObject([{ name: 'Booker One', inviteLabel: 'Gran' }])
    expect((await services.accounts.listInvites(sitterId))[0]).toMatchObject({ status: 'used', bookerName: 'Booker One' })

    expect((await services.accounts.previewInvite(invite.token)).valid).toBe(false)
    await expect(services.accounts.registerBooker('user_c', 'c@example.com', invite.token, bookerInput)).rejects.toThrow(GoneError)
    expect(await services.accounts.findBookerId('user_c')).toBeUndefined()
  })

  it('rejects unknown, expired and disabled links', async () => {
    const { services, advance } = await setup()
    await services.accounts.registerSitter('user_s', 's@example.com', sitterInput)
    const sitterId = (await services.accounts.findSitterId('user_s'))!

    await expect(services.accounts.registerBooker('u1', 'u1@example.com', 'x'.repeat(43), bookerInput)).rejects.toThrow(GoneError)

    const expiring = await services.accounts.createInvite(sitterId, { expiresInHours: 1 })
    advance(2)
    expect((await services.accounts.listInvites(sitterId)).find(i => i.id === expiring.id)?.status).toBe('expired')
    await expect(services.accounts.registerBooker('u2', 'u2@example.com', expiring.token, bookerInput)).rejects.toThrow(GoneError)

    const disabled = await services.accounts.createInvite(sitterId, { expiresInHours: 24 })
    await services.accounts.disableInvite(sitterId, disabled.id)
    expect((await services.accounts.listInvites(sitterId)).find(i => i.id === disabled.id)?.status).toBe('disabled')
    await expect(services.accounts.registerBooker('u3', 'u3@example.com', disabled.token, bookerInput)).rejects.toThrow(GoneError)
  })

  it('stores only a hash of the token and keeps profile edits for autofill', async () => {
    const { db, services } = await setup()
    await services.accounts.registerSitter('user_s', 's@example.com', sitterInput)
    const sitterId = (await services.accounts.findSitterId('user_s'))!
    const invite = await services.accounts.createInvite(sitterId, { expiresInHours: 24 })
    const stored = await getRow<{ token_hash: string }>(db, 'SELECT token_hash FROM booker_invites')
    expect(stored!.token_hash).not.toContain(invite.token)

    await services.accounts.registerBooker('user_b', 'b@example.com', invite.token, bookerInput)
    const bookerId = (await services.accounts.findBookerId('user_b'))!
    const updated = await services.accounts.updateBookerProfile(bookerId, { ...bookerInput, pets: [] })
    expect(updated.pets).toEqual([])
    expect(updated.emergencyContact.name).toBe('Sam')
  })
})
