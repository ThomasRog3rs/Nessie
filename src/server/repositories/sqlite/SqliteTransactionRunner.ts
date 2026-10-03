import type { Database } from '../../db/connection.ts'
import { inTransaction } from '../../db/connection.ts'
import type { TransactionRunner } from '../contracts.ts'

export class SqliteTransactionRunner implements TransactionRunner {
  private readonly db: Database
  private depth = 0

  constructor(db: Database) {
    this.db = db
  }

  /** Re-entrant: nested calls join the outer transaction. */
  run<T>(work: () => T): T {
    if (this.depth > 0) return work()
    this.depth++
    try {
      return inTransaction(this.db, work)
    }
    finally {
      this.depth--
    }
  }
}
