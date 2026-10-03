import type { BookerInvite, BookerProfile, BookerProfileInput, LinkedBooker } from '../../../shared/types/booking.ts'
import type { Database } from '../../db/connection.ts'
import type { AccountRepository, InviteRecord, NewBooker, NewInvite } from '../contracts.ts'

interface BookerRow {
  name: string
  email: string
  phone: string
  address_line: string
  city: string
  postcode: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  vet_name: string
  vet_phone: string
  emergency_instructions: string
  property_instructions: string
}

const PROFILE_COLUMNS = `name, email, phone, address_line, city, postcode, emergency_contact_name, emergency_contact_phone,
  emergency_contact_relationship, vet_name, vet_phone, emergency_instructions, property_instructions`

export class SqliteAccountRepository implements AccountRepository {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  findSitterIdByClerkUser(clerkUserId: string): string | undefined {
    const row = this.db.prepare('SELECT id FROM sitters WHERE clerk_user_id = ?').get(clerkUserId) as { id: string } | undefined
    return row?.id
  }

  findBookerIdByClerkUser(clerkUserId: string): string | undefined {
    const row = this.db.prepare('SELECT id FROM bookers WHERE clerk_user_id = ?').get(clerkUserId) as { id: string } | undefined
    return row?.id
  }

  countClaimedSitters(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM sitters WHERE clerk_user_id IS NOT NULL').get() as { n: number }
    return row.n
  }

  findUnclaimedSitterId(): string | undefined {
    const row = this.db.prepare('SELECT id FROM sitters WHERE clerk_user_id IS NULL LIMIT 1').get() as { id: string } | undefined
    return row?.id
  }

  claimSitter(sitterId: string, clerkUserId: string, email: string): void {
    this.db.prepare('UPDATE sitters SET clerk_user_id = ?, email = ? WHERE id = ?').run(clerkUserId, email, sitterId)
  }

  insertSitter(sitter: { id: string, clerkUserId: string, email: string, createdAt: string }): void {
    this.db.prepare(`INSERT INTO sitters (id, clerk_user_id, name, email, bio, rate_pence, rate_basis, currency, timezone, created_at)
      VALUES (?, ?, '', ?, '', 0, 'per_night', 'GBP', 'Europe/London', ?)`)
      .run(sitter.id, sitter.clerkUserId, sitter.email, sitter.createdAt)
  }

  insertInvite(invite: NewInvite): void {
    this.db.prepare(`INSERT INTO booker_invites (id, sitter_id, token_hash, label, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(invite.id, invite.sitterId, invite.tokenHash, invite.label, invite.createdAt, invite.expiresAt)
  }

  findInviteByHash(tokenHash: string): InviteRecord | undefined {
    const row = this.db.prepare(`SELECT i.id, i.sitter_id, s.name AS sitter_name, i.expires_at, i.disabled_at, i.used_at
      FROM booker_invites i JOIN sitters s ON s.id = i.sitter_id WHERE i.token_hash = ?`).get(tokenHash) as {
      id: string, sitter_id: string, sitter_name: string, expires_at: string, disabled_at: string | null, used_at: string | null
    } | undefined
    if (!row) return undefined
    return {
      id: row.id,
      sitterId: row.sitter_id,
      sitterName: row.sitter_name,
      expiresAt: row.expires_at,
      ...(row.disabled_at ? { disabledAt: row.disabled_at } : {}),
      ...(row.used_at ? { usedAt: row.used_at } : {}),
    }
  }

  listInvites(sitterId: string): Array<Omit<BookerInvite, 'status'> & { disabledAt?: string }> {
    const rows = this.db.prepare(`SELECT i.id, i.label, i.created_at, i.expires_at, i.disabled_at, i.used_at, b.name AS booker_name
      FROM booker_invites i LEFT JOIN bookers b ON b.id = i.used_by_booker_id
      WHERE i.sitter_id = ? ORDER BY i.created_at DESC, i.id`).all(sitterId) as unknown as Array<{
      id: string, label: string, created_at: string, expires_at: string,
      disabled_at: string | null, used_at: string | null, booker_name: string | null
    }>
    return rows.map(row => ({
      id: row.id,
      label: row.label,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      ...(row.disabled_at ? { disabledAt: row.disabled_at } : {}),
      ...(row.used_at ? { usedAt: row.used_at } : {}),
      ...(row.booker_name ? { bookerName: row.booker_name } : {}),
    }))
  }

  disableInvite(sitterId: string, inviteId: string, at: string): boolean {
    const result = this.db.prepare(`UPDATE booker_invites SET disabled_at = ?
      WHERE id = ? AND sitter_id = ? AND disabled_at IS NULL`).run(at, inviteId, sitterId)
    return Number(result.changes) > 0
  }

  consumeInvite(inviteId: string, bookerId: string, at: string): boolean {
    const result = this.db.prepare(`UPDATE booker_invites SET used_at = ?, used_by_booker_id = ?
      WHERE id = ? AND used_at IS NULL AND disabled_at IS NULL AND expires_at > ?`).run(at, bookerId, inviteId, at)
    return Number(result.changes) > 0
  }

  insertBooker(booker: NewBooker): void {
    const p = booker.profile
    this.db.prepare(`INSERT INTO bookers (id, clerk_user_id, name, email, created_at, phone, address_line, city, postcode,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, vet_name, vet_phone,
      emergency_instructions, property_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      booker.id, booker.clerkUserId, p.name, booker.email, booker.createdAt, p.phone, p.addressLine, p.city, p.postcode,
      p.emergencyContact.name, p.emergencyContact.phone, p.emergencyContact.relationship, p.vet.name, p.vet.phone,
      p.emergencyInstructions, p.propertyInstructions,
    )
    this.replacePets(booker.id, p.pets)
  }

  linkBookerToSitter(bookerId: string, sitterId: string, createdAt: string): void {
    this.db.prepare('INSERT INTO booker_sitter_links (booker_id, sitter_id, created_at) VALUES (?, ?, ?)')
      .run(bookerId, sitterId, createdAt)
  }

  findBookerProfile(bookerId: string): BookerProfile | undefined {
    const row = this.db.prepare(`SELECT ${PROFILE_COLUMNS} FROM bookers WHERE id = ?`).get(bookerId) as BookerRow | undefined
    if (!row) return undefined
    const pets = this.db.prepare('SELECT name, species, notes FROM booker_pets WHERE booker_id = ? ORDER BY position')
      .all(bookerId) as unknown as BookerProfile['pets']
    return {
      name: row.name,
      email: row.email,
      phone: row.phone,
      addressLine: row.address_line,
      city: row.city,
      postcode: row.postcode,
      emergencyContact: {
        name: row.emergency_contact_name,
        phone: row.emergency_contact_phone,
        relationship: row.emergency_contact_relationship,
      },
      vet: { name: row.vet_name, phone: row.vet_phone },
      emergencyInstructions: row.emergency_instructions,
      propertyInstructions: row.property_instructions,
      pets: pets.map(pet => ({ name: pet.name, species: pet.species, notes: pet.notes })),
    }
  }

  updateBookerProfile(bookerId: string, p: BookerProfileInput): void {
    this.db.prepare(`UPDATE bookers SET name = ?, phone = ?, address_line = ?, city = ?, postcode = ?,
      emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_relationship = ?,
      vet_name = ?, vet_phone = ?, emergency_instructions = ?, property_instructions = ? WHERE id = ?`).run(
      p.name, p.phone, p.addressLine, p.city, p.postcode,
      p.emergencyContact.name, p.emergencyContact.phone, p.emergencyContact.relationship,
      p.vet.name, p.vet.phone, p.emergencyInstructions, p.propertyInstructions, bookerId,
    )
    this.replacePets(bookerId, p.pets)
  }

  listBookersForSitter(sitterId: string): LinkedBooker[] {
    const rows = this.db.prepare(`SELECT b.id, b.name, b.email, b.phone, b.created_at, i.label
      FROM bookers b
      JOIN booker_sitter_links l ON l.booker_id = b.id
      JOIN booker_invites i ON i.used_by_booker_id = b.id AND i.sitter_id = l.sitter_id
      WHERE l.sitter_id = ? ORDER BY b.created_at DESC, b.id`).all(sitterId) as unknown as Array<{
      id: string, name: string, email: string, phone: string, created_at: string, label: string
    }>
    return rows.map(row => ({
      id: row.id, name: row.name, email: row.email, phone: row.phone, joinedAt: row.created_at, inviteLabel: row.label,
    }))
  }

  private replacePets(bookerId: string, pets: BookerProfileInput['pets']): void {
    this.db.prepare('DELETE FROM booker_pets WHERE booker_id = ?').run(bookerId)
    const insert = this.db.prepare('INSERT INTO booker_pets (booker_id, name, species, notes, position) VALUES (?, ?, ?, ?, ?)')
    pets.forEach((pet, position) => insert.run(bookerId, pet.name, pet.species, pet.notes, position))
  }
}
