import type { Database } from '../../db/connection.ts'
import type { TransactionRunner } from '../contracts.ts'

export class SqliteTransactionRunner implements TransactionRunner {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  /** Re-entrant: nested calls join the outer write transaction. */
  run<T>(work: () => Promise<T>): Promise<T> {
    return this.db.runInTransaction('write', work)
  }
}
