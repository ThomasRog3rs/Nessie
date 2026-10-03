import { describe, expect, it } from 'vitest'
import { ConflictError, ForbiddenError, GoneError } from '../server/domain/errors.ts'
import { openDatabase } from '../server/db/connection.ts'
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
    expect(services.accounts.isSitterSignupOpen()).toBe(true)
    services.accounts.registerSitter('user_a', 'a@example.com', sitterInput)
    expect(services.accounts.isSitterSignupOpen()).toBe(false)
    expect(services.accounts.describe('user_a').role).toBe('sitter')
    expect(() => services.accounts.registerSitter('user_b', 'b@example.com', sitterInput)).toThrow(ForbiddenError)
  })

  it('refuses to register the same sign-in twice', async () => {
    const { services } = await setup()
    services.accounts.registerSitter('user_a', 'a@example.com', sitterInput)
    expect(() => services.accounts.registerSitter('user_a', 'a@example.com', sitterInput)).toThrow(ConflictError)
  })

  it('enforces a single sitter in the database itself', async () => {
    const db = openDatabase(':memory:')
    const { Migrator } = await import('../server/db/migrator.ts')
    const { migrationSource } = await import('./helpers.ts')
    await new Migrator(db, migrationSource).migrate()
    const insert = db.prepare(`INSERT INTO sitters (id, name, email, bio, rate_pence, rate_basis, timezone, created_at)
      VALUES (?, 'n', ?, '', 0, 'per_night', 'Europe/London', 'now')`)
    insert.run('s1', 's1@example.com')
    expect(() => insert.run('s2', 's2@example.com')).toThrow()
  })
})

describe('booker invite links', () => {
  it('lets a booker join once, links them to the inviting sitter and then burns the link', async () => {
    const { services } = await setup()
    services.accounts.registerSitter('user_s', 's@example.com', sitterInput)
    const sitterId = services.accounts.findSitterId('user_s')!
    const invite = services.accounts.createInvite(sitterId, { label: 'Gran', expiresInHours: 24 })

    expect(services.accounts.previewInvite(invite.token)).toEqual({ valid: true, sitterName: 'Sitter One' })
    const profile = services.accounts.registerBooker('user_b', 'b@example.com', invite.token, bookerInput)
    expect(profile).toMatchObject({ email: 'b@example.com', pets: [{ name: 'Rex' }], addressLine: '1 High St' })

    const bookerId = services.accounts.findBookerId('user_b')!
    expect(services.sitters.getPreferredSitter(bookerId).id).toBe(sitterId)
    expect(services.accounts.listLinkedBookers(sitterId)).toMatchObject([{ name: 'Booker One', inviteLabel: 'Gran' }])
    expect(services.accounts.listInvites(sitterId)[0]).toMatchObject({ status: 'used', bookerName: 'Booker One' })

    expect(services.accounts.previewInvite(invite.token).valid).toBe(false)
    expect(() => services.accounts.registerBooker('user_c', 'c@example.com', invite.token, bookerInput)).toThrow(GoneError)
    expect(services.accounts.findBookerId('user_c')).toBeUndefined()
  })

  it('rejects unknown, expired and disabled links', async () => {
    const { services, advance } = await setup()
    services.accounts.registerSitter('user_s', 's@example.com', sitterInput)
    const sitterId = services.accounts.findSitterId('user_s')!

    expect(() => services.accounts.registerBooker('u1', 'u1@example.com', 'x'.repeat(43), bookerInput)).toThrow(GoneError)

    const expiring = services.accounts.createInvite(sitterId, { expiresInHours: 1 })
    advance(2)
    expect(services.accounts.listInvites(sitterId).find(i => i.id === expiring.id)?.status).toBe('expired')
    expect(() => services.accounts.registerBooker('u2', 'u2@example.com', expiring.token, bookerInput)).toThrow(GoneError)

    const disabled = services.accounts.createInvite(sitterId, { expiresInHours: 24 })
    services.accounts.disableInvite(sitterId, disabled.id)
    expect(services.accounts.listInvites(sitterId).find(i => i.id === disabled.id)?.status).toBe('disabled')
    expect(() => services.accounts.registerBooker('u3', 'u3@example.com', disabled.token, bookerInput)).toThrow(GoneError)
  })

  it('stores only a hash of the token and keeps profile edits for autofill', async () => {
    const { db, services } = await setup()
    services.accounts.registerSitter('user_s', 's@example.com', sitterInput)
    const sitterId = services.accounts.findSitterId('user_s')!
    const invite = services.accounts.createInvite(sitterId, { expiresInHours: 24 })
    const stored = db.prepare('SELECT token_hash FROM booker_invites').get() as { token_hash: string }
    expect(stored.token_hash).not.toContain(invite.token)

    services.accounts.registerBooker('user_b', 'b@example.com', invite.token, bookerInput)
    const bookerId = services.accounts.findBookerId('user_b')!
    const updated = services.accounts.updateBookerProfile(bookerId, { ...bookerInput, pets: [] })
    expect(updated.pets).toEqual([])
    expect(updated.emergencyContact.name).toBe('Sam')
  })
})
