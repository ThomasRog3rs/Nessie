import type { AvailabilityBlock, AvailabilityBlockInput } from '../../../shared/types/booking.ts'
import { getAll, getRow, runStatement } from '../../db/connection.ts'
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

  async findById(sitterId: string, blockId: string): Promise<AvailabilityBlock | undefined> {
    const row = await getRow<BlockRow>(
      this.db,
      'SELECT id, start_date, end_date, reason FROM availability_blocks WHERE id = ? AND sitter_id = ?',
      [blockId, sitterId],
    )
    return row && toBlock(row)
  }

  async listIntersecting(sitterId: string, from: string, to: string): Promise<AvailabilityBlock[]> {
    const rows = await getAll<BlockRow>(this.db, `SELECT id, start_date, end_date, reason FROM availability_blocks
      WHERE sitter_id = ? AND start_date <= ? AND end_date >= ? ORDER BY start_date`, [sitterId, to, from])
    return rows.map(toBlock)
  }

  async listAll(sitterId: string): Promise<AvailabilityBlock[]> {
    const rows = await getAll<BlockRow>(
      this.db,
      'SELECT id, start_date, end_date, reason FROM availability_blocks WHERE sitter_id = ? ORDER BY start_date',
      [sitterId],
    )
    return rows.map(toBlock)
  }

  async insert(sitterId: string, input: AvailabilityBlockInput, id: string, createdAt: string): Promise<AvailabilityBlock> {
    await runStatement(this.db, 'INSERT INTO availability_blocks (id, sitter_id, start_date, end_date, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, sitterId, input.startDate, input.endDate, input.reason, createdAt])
    return { id, ...input }
  }

  async update(blockId: string, input: AvailabilityBlockInput): Promise<void> {
    await runStatement(this.db, 'UPDATE availability_blocks SET start_date = ?, end_date = ?, reason = ? WHERE id = ?',
      [input.startDate, input.endDate, input.reason, blockId])
  }

  async delete(blockId: string): Promise<void> {
    await runStatement(this.db, 'DELETE FROM availability_blocks WHERE id = ?', [blockId])
  }
}
