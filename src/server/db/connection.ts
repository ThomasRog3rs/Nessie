import { AsyncLocalStorage } from 'node:async_hooks'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createClient } from '@libsql/client'
import type { Client, Config, InArgs, InStatement, ResultSet, Row, Transaction, TransactionMode } from '@libsql/client'

export type SqlArgs = InArgs
export interface SqlExecutor {
  execute(stmt: InStatement): Promise<ResultSet>
  batch(stmts: Array<InStatement>, mode?: TransactionMode): Promise<Array<ResultSet>>
  executeMultiple(sql: string): Promise<void>
}

const BUSY_TIMEOUT_MS = 5_000
const FILE_PREFIX = 'file:'
const MEMORY_URLS = new Set([':memory:', 'file::memory:'])

function normaliseDatabaseUrl(url: string): string {
  return url === ':memory:' ? 'file::memory:' : url
}

function databasePathFromUrl(url: string): string | null {
  const normalised = normaliseDatabaseUrl(url)
  if (!normalised.startsWith(FILE_PREFIX) || MEMORY_URLS.has(normalised)) return null

  const rawPath = normalised.slice(FILE_PREFIX.length)
  if (rawPath.startsWith('//')) {
    const parsed = new URL(normalised)
    return parsed.pathname ? decodeURIComponent(parsed.pathname) : null
  }
  return resolve(rawPath)
}

function isFileDatabaseUrl(url: string): boolean {
  return normaliseDatabaseUrl(url).startsWith(FILE_PREFIX)
}

async function configureClient(client: Client, url: string): Promise<void> {
  await client.execute('PRAGMA foreign_keys = ON')
  if (isFileDatabaseUrl(url)) await client.execute(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`)
  const databasePath = databasePathFromUrl(url)
  if (databasePath) await client.execute('PRAGMA journal_mode = WAL')
}

export class Database implements SqlExecutor {
  private readonly client: Client
  private readonly transactions = new AsyncLocalStorage<Transaction>()
  readonly url: string

  constructor(client: Client, url: string) {
    this.client = client
    this.url = normaliseDatabaseUrl(url)
  }

  private currentExecutor(): SqlExecutor {
    return this.transactions.getStore() ?? this.client
  }

  async execute(stmt: InStatement): Promise<ResultSet> {
    return this.currentExecutor().execute(stmt)
  }

  async batch(stmts: Array<InStatement>, mode?: TransactionMode): Promise<Array<ResultSet>> {
    const executor = this.currentExecutor()
    if (executor === this.client) return this.client.batch(stmts, mode)
    return executor.batch(stmts)
  }

  async executeMultiple(sql: string): Promise<void> {
    return this.currentExecutor().executeMultiple(sql)
  }

  async runInTransaction<T>(mode: TransactionMode, work: () => Promise<T>): Promise<T> {
    if (this.transactions.getStore()) return work()

    const transaction = await this.client.transaction(mode)
    try {
      await transaction.execute('PRAGMA foreign_keys = ON')
      const result = await this.transactions.run(transaction, work)
      await transaction.commit()
      return result
    }
    catch (error) {
      if (!transaction.closed) await transaction.rollback()
      throw error
    }
    finally {
      transaction.close()
    }
  }

  close(): void {
    this.client.close()
  }
}

export async function openDatabase(url: string, authToken?: string): Promise<Database> {
  const databasePath = databasePathFromUrl(url)
  if (databasePath) mkdirSync(dirname(databasePath), { recursive: true })

  const normalisedUrl = normaliseDatabaseUrl(url)
  const config: Config = {
    url: normalisedUrl,
    authToken,
    intMode: 'number',
    timeout: isFileDatabaseUrl(normalisedUrl) ? BUSY_TIMEOUT_MS : undefined,
  }

  const client = createClient(config)
  const db = new Database(client, normalisedUrl)
  try {
    await configureClient(client, normalisedUrl)
    return db
  }
  catch (error) {
    db.close()
    throw error
  }
}

export async function getRow<T>(db: SqlExecutor, sql: string, args: SqlArgs = []): Promise<T | undefined> {
  const result = await db.execute({ sql, args })
  return result.rows[0] as T | undefined
}

export async function getAll<T>(db: SqlExecutor, sql: string, args: SqlArgs = []): Promise<T[]> {
  const result = await db.execute({ sql, args })
  return result.rows as unknown as T[]
}

export async function runStatement(db: SqlExecutor, sql: string, args: SqlArgs = []): Promise<ResultSet> {
  return db.execute({ sql, args })
}

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

export function rowToObject<T>(row: Row): T {
  return row as unknown as T
}
