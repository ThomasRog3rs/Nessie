import type { OptionalService, RateBasis, Sitter } from '../../../shared/types/booking.ts'
import { getAll, getRow, runStatement } from '../../db/connection.ts'
import type { Database } from '../../db/connection.ts'
import type { PersistableSitterProfile, SitterRepository } from '../contracts.ts'

interface SitterRow {
  id: string
  name: string
  bio: string
  location: string
  contact_phone: string
  rate_pence: number
  rate_basis: RateBasis
  currency: 'GBP'
  timezone: string
}

interface ServiceRow {
  id: string
  name: string
  description: string
  price_pence: number
}

export class SqliteSitterRepository implements SitterRepository {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  async findById(sitterId: string): Promise<Sitter | undefined> {
    const row = await getRow<SitterRow>(
      this.db,
      'SELECT id, name, bio, location, contact_phone, rate_pence, rate_basis, currency, timezone FROM sitters WHERE id = ?',
      [sitterId],
    )
    return row && this.hydrate(row)
  }

  async findPreferredForBooker(bookerId: string): Promise<Sitter | undefined> {
    const row = await getRow<SitterRow>(this.db, `SELECT s.id, s.name, s.bio, s.location, s.contact_phone, s.rate_pence, s.rate_basis, s.currency, s.timezone
      FROM sitters s JOIN booker_sitter_links l ON l.sitter_id = s.id
      WHERE l.booker_id = ? ORDER BY l.created_at, s.id LIMIT 1`, [bookerId])
    return row && this.hydrate(row)
  }

  async updateProfile(sitterId: string, input: PersistableSitterProfile): Promise<void> {
    await runStatement(this.db, `UPDATE sitters SET name = ?, location = ?, bio = ?, contact_phone = ?, rate_pence = ?, rate_basis = ?
      WHERE id = ?`, [input.name, input.location, input.bio, input.phone, input.rate, input.rateBasis, sitterId])
    await runStatement(this.db, 'DELETE FROM sitter_accepted_pets WHERE sitter_id = ?', [sitterId])
    for (const [position, species] of input.acceptedPets.entries()) {
      await runStatement(this.db, 'INSERT INTO sitter_accepted_pets (sitter_id, species, position) VALUES (?, ?, ?)', [sitterId, species, position])
    }
    await runStatement(this.db, 'DELETE FROM sitter_services WHERE sitter_id = ?', [sitterId])
    for (const [position, item] of input.optionalServices.entries()) {
      await runStatement(this.db, `INSERT INTO sitter_services (id, sitter_id, name, description, price_pence, position, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)`, [item.id, sitterId, item.name, item.description ?? '', item.price, position])
    }
  }

  private async hydrate(row: SitterRow): Promise<Sitter> {
    const pets = await getAll<{ species: string }>(
      this.db,
      'SELECT species FROM sitter_accepted_pets WHERE sitter_id = ? ORDER BY position',
      [row.id],
    )
    const services = await getAll<ServiceRow>(
      this.db,
      `SELECT id, name, description, price_pence FROM sitter_services
      WHERE sitter_id = ? AND is_active = 1 ORDER BY position`,
      [row.id],
    )
    return {
      id: row.id,
      name: row.name,
      location: row.location,
      bio: row.bio,
      rate: row.rate_pence,
      rateBasis: row.rate_basis,
      currency: row.currency,
      timezone: row.timezone,
      acceptedPets: pets.map(p => p.species),
      phone: row.contact_phone,
      optionalServices: services.map((service): OptionalService => ({
        id: service.id,
        name: service.name,
        ...(service.description ? { description: service.description } : {}),
        price: service.price_pence,
      })),
    }
  }
}
