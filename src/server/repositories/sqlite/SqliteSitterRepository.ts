import type { OptionalService, RateBasis, Sitter } from '../../../shared/types/booking.ts'
import type { Database } from '../../db/connection.ts'
import type { SitterRepository } from '../contracts.ts'

interface SitterRow {
  id: string
  name: string
  bio: string
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

  findById(sitterId: string): Sitter | undefined {
    const row = this.db.prepare('SELECT id, name, bio, rate_pence, rate_basis, currency, timezone FROM sitters WHERE id = ?')
      .get(sitterId) as SitterRow | undefined
    return row && this.hydrate(row)
  }

  findPreferredForBooker(bookerId: string): Sitter | undefined {
    const row = this.db.prepare(`SELECT s.id, s.name, s.bio, s.rate_pence, s.rate_basis, s.currency, s.timezone
      FROM sitters s JOIN booker_sitter_links l ON l.sitter_id = s.id
      WHERE l.booker_id = ? ORDER BY l.created_at, s.id LIMIT 1`).get(bookerId) as SitterRow | undefined
    return row && this.hydrate(row)
  }

  private hydrate(row: SitterRow): Sitter {
    const pets = this.db.prepare('SELECT species FROM sitter_accepted_pets WHERE sitter_id = ? ORDER BY position')
      .all(row.id) as unknown as Array<{ species: string }>
    const services = this.db.prepare(`SELECT id, name, description, price_pence FROM sitter_services
      WHERE sitter_id = ? AND is_active = 1 ORDER BY position`).all(row.id) as unknown as ServiceRow[]
    return {
      id: row.id,
      name: row.name,
      bio: row.bio,
      rate: row.rate_pence,
      rateBasis: row.rate_basis,
      currency: row.currency,
      timezone: row.timezone,
      acceptedPets: pets.map(p => p.species),
      optionalServices: services.map((s): OptionalService => ({
        id: s.id,
        name: s.name,
        ...(s.description ? { description: s.description } : {}),
        price: s.price_pence,
      })),
    }
  }
}
