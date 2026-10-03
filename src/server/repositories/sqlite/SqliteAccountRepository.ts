import type { BookerInvite, BookerProfile, BookerProfileInput, LinkedBooker } from '../../../shared/types/booking.ts'
import { getAll, getRow, runStatement } from '../../db/connection.ts'
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

  async findSitterIdByClerkUser(clerkUserId: string): Promise<string | undefined> {
    const row = await getRow<{ id: string }>(this.db, 'SELECT id FROM sitters WHERE clerk_user_id = ?', [clerkUserId])
    return row?.id
  }

  async findBookerIdByClerkUser(clerkUserId: string): Promise<string | undefined> {
    const row = await getRow<{ id: string }>(this.db, 'SELECT id FROM bookers WHERE clerk_user_id = ?', [clerkUserId])
    return row?.id
  }

  async countClaimedSitters(): Promise<number> {
    const row = await getRow<{ n: number }>(this.db, 'SELECT COUNT(*) AS n FROM sitters WHERE clerk_user_id IS NOT NULL')
    return row?.n ?? 0
  }

  async findUnclaimedSitterId(): Promise<string | undefined> {
    const row = await getRow<{ id: string }>(this.db, 'SELECT id FROM sitters WHERE clerk_user_id IS NULL LIMIT 1')
    return row?.id
  }

  async claimSitter(sitterId: string, clerkUserId: string, email: string): Promise<void> {
    await runStatement(this.db, 'UPDATE sitters SET clerk_user_id = ?, email = ? WHERE id = ?', [clerkUserId, email, sitterId])
  }

  async insertSitter(sitter: { id: string, clerkUserId: string, email: string, createdAt: string }): Promise<void> {
    await runStatement(this.db, `INSERT INTO sitters (id, clerk_user_id, name, email, bio, rate_pence, rate_basis, currency, timezone, created_at)
      VALUES (?, ?, '', ?, '', 0, 'per_night', 'GBP', 'Europe/London', ?)`,
    [sitter.id, sitter.clerkUserId, sitter.email, sitter.createdAt])
  }

  async insertInvite(invite: NewInvite): Promise<void> {
    await runStatement(this.db, `INSERT INTO booker_invites (id, sitter_id, token_hash, label, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [invite.id, invite.sitterId, invite.tokenHash, invite.label, invite.createdAt, invite.expiresAt])
  }

  async findInviteByHash(tokenHash: string): Promise<InviteRecord | undefined> {
    const row = await getRow<{
      id: string
      sitter_id: string
      sitter_name: string
      expires_at: string
      disabled_at: string | null
      used_at: string | null
    }>(this.db, `SELECT i.id, i.sitter_id, s.name AS sitter_name, i.expires_at, i.disabled_at, i.used_at
      FROM booker_invites i JOIN sitters s ON s.id = i.sitter_id WHERE i.token_hash = ?`, [tokenHash])
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

  async listInvites(sitterId: string): Promise<Array<Omit<BookerInvite, 'status'> & { disabledAt?: string }>> {
    const rows = await getAll<{
      id: string
      label: string
      created_at: string
      expires_at: string
      disabled_at: string | null
      used_at: string | null
      booker_name: string | null
    }>(this.db, `SELECT i.id, i.label, i.created_at, i.expires_at, i.disabled_at, i.used_at, b.name AS booker_name
      FROM booker_invites i LEFT JOIN bookers b ON b.id = i.used_by_booker_id
      WHERE i.sitter_id = ? ORDER BY i.created_at DESC, i.id`, [sitterId])
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

  async disableInvite(sitterId: string, inviteId: string, at: string): Promise<boolean> {
    const result = await runStatement(this.db, `UPDATE booker_invites SET disabled_at = ?
      WHERE id = ? AND sitter_id = ? AND disabled_at IS NULL`, [at, inviteId, sitterId])
    return result.rowsAffected > 0
  }

  async consumeInvite(inviteId: string, bookerId: string, at: string): Promise<boolean> {
    const result = await runStatement(this.db, `UPDATE booker_invites SET used_at = ?, used_by_booker_id = ?
      WHERE id = ? AND used_at IS NULL AND disabled_at IS NULL AND expires_at > ?`, [at, bookerId, inviteId, at])
    return result.rowsAffected > 0
  }

  async insertBooker(booker: NewBooker): Promise<void> {
    const profile = booker.profile
    await runStatement(this.db, `INSERT INTO bookers (id, clerk_user_id, name, email, created_at, phone, address_line, city, postcode,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, vet_name, vet_phone,
      emergency_instructions, property_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      booker.id, booker.clerkUserId, profile.name, booker.email, booker.createdAt, profile.phone, profile.addressLine, profile.city, profile.postcode,
      profile.emergencyContact.name, profile.emergencyContact.phone, profile.emergencyContact.relationship, profile.vet.name, profile.vet.phone,
      profile.emergencyInstructions, profile.propertyInstructions,
    ])
    await this.replacePets(booker.id, profile.pets)
  }

  async linkBookerToSitter(bookerId: string, sitterId: string, createdAt: string): Promise<void> {
    await runStatement(this.db, 'INSERT INTO booker_sitter_links (booker_id, sitter_id, created_at) VALUES (?, ?, ?)',
      [bookerId, sitterId, createdAt])
  }

  async findBookerProfile(bookerId: string): Promise<BookerProfile | undefined> {
    const row = await getRow<BookerRow>(this.db, `SELECT ${PROFILE_COLUMNS} FROM bookers WHERE id = ?`, [bookerId])
    if (!row) return undefined
    const pets = await getAll<BookerProfile['pets'][number]>(
      this.db,
      'SELECT name, species, notes FROM booker_pets WHERE booker_id = ? ORDER BY position',
      [bookerId],
    )
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

  async updateBookerProfile(bookerId: string, profile: BookerProfileInput): Promise<void> {
    await runStatement(this.db, `UPDATE bookers SET name = ?, phone = ?, address_line = ?, city = ?, postcode = ?,
      emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_relationship = ?,
      vet_name = ?, vet_phone = ?, emergency_instructions = ?, property_instructions = ? WHERE id = ?`, [
      profile.name, profile.phone, profile.addressLine, profile.city, profile.postcode,
      profile.emergencyContact.name, profile.emergencyContact.phone, profile.emergencyContact.relationship,
      profile.vet.name, profile.vet.phone, profile.emergencyInstructions, profile.propertyInstructions, bookerId,
    ])
    await this.replacePets(bookerId, profile.pets)
  }

  async listBookersForSitter(sitterId: string): Promise<LinkedBooker[]> {
    const rows = await getAll<{
      id: string
      name: string
      email: string
      phone: string
      created_at: string
      label: string
    }>(this.db, `SELECT b.id, b.name, b.email, b.phone, b.created_at, i.label
      FROM bookers b
      JOIN booker_sitter_links l ON l.booker_id = b.id
      JOIN booker_invites i ON i.used_by_booker_id = b.id AND i.sitter_id = l.sitter_id
      WHERE l.sitter_id = ? ORDER BY b.created_at DESC, b.id`, [sitterId])
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      joinedAt: row.created_at,
      inviteLabel: row.label,
    }))
  }

  private async replacePets(bookerId: string, pets: BookerProfileInput['pets']): Promise<void> {
    await runStatement(this.db, 'DELETE FROM booker_pets WHERE booker_id = ?', [bookerId])
    for (const [position, pet] of pets.entries()) {
      await runStatement(this.db, 'INSERT INTO booker_pets (booker_id, name, species, notes, position) VALUES (?, ?, ?, ?, ?)',
        [bookerId, pet.name, pet.species, pet.notes, position])
    }
  }
}
