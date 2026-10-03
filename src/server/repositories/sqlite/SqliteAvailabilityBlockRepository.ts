import type { AvailabilityBlock, AvailabilityBlockInput } from '../../../shared/types/booking.ts'
import type { Database } from '../../db/connection.ts'
import type { AvailabilityBlockRepository } from '../contracts.ts'

interface BlockRow {
  id: string
  start_date: string
  end_date: string
  reason: string
}

const toBlock = (row: BlockRow): AvailabilityBlock => ({
  id: row.id,
  startDate: row.start_date,
  endDate: row.end_date,
  reason: row.reason,
})

export class SqliteAvailabilityBlockRepository implements AvailabilityBlockRepository {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  findById(sitterId: string, blockId: string): AvailabilityBlock | undefined {
    const row = this.db.prepare('SELECT id, start_date, end_date, reason FROM availability_blocks WHERE id = ? AND sitter_id = ?')
      .get(blockId, sitterId) as BlockRow | undefined
    return row && toBlock(row)
  }

  listIntersecting(sitterId: string, from: string, to: string): AvailabilityBlock[] {
    const rows = this.db.prepare(`SELECT id, start_date, end_date, reason FROM availability_blocks
      WHERE sitter_id = ? AND start_date <= ? AND end_date >= ? ORDER BY start_date`)
      .all(sitterId, to, from) as unknown as BlockRow[]
    return rows.map(toBlock)
  }

  listAll(sitterId: string): AvailabilityBlock[] {
    const rows = this.db.prepare('SELECT id, start_date, end_date, reason FROM availability_blocks WHERE sitter_id = ? ORDER BY start_date')
      .all(sitterId) as unknown as BlockRow[]
    return rows.map(toBlock)
  }

  insert(sitterId: string, input: AvailabilityBlockInput, id: string, createdAt: string): AvailabilityBlock {
    this.db.prepare('INSERT INTO availability_blocks (id, sitter_id, start_date, end_date, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, sitterId, input.startDate, input.endDate, input.reason, createdAt)
    return { id, ...input }
  }

  update(blockId: string, input: AvailabilityBlockInput): void {
    this.db.prepare('UPDATE availability_blocks SET start_date = ?, end_date = ?, reason = ? WHERE id = ?')
      .run(input.startDate, input.endDate, input.reason, blockId)
  }

  delete(blockId: string): void {
    this.db.prepare('DELETE FROM availability_blocks WHERE id = ?').run(blockId)
  }
}
