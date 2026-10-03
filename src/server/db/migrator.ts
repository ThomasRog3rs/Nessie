import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAll, getRow, runStatement } from './connection.ts'
import type { Database } from './connection.ts'

export interface Migration {
  version: number
  name: string
  sql: string
}

/** Where migrations come from; lets the CLI read files and Nitro read bundled assets. */
export interface MigrationSource {
  load(): Promise<Migration[]> | Migration[]
}

export interface AppliedMigration {
  version: number
  name: string
  checksum: string
  appliedAt: string
}

export interface MigrationStatus {
  applied: AppliedMigration[]
  pending: Migration[]
  currentVersion: number
}

export class MigrationError extends Error {}

const FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/

export function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex')
}

export function parseMigrationFile(fileName: string, sql: string): Migration {
  const match = FILE_PATTERN.exec(fileName)
  if (!match) throw new MigrationError(`Invalid migration file name: ${fileName}`)
  return { version: Number(match[1]), name: match[2]!, sql }
}

export class FileMigrationSource implements MigrationSource {
  private readonly directory: string

  constructor(directory: string) {
    this.directory = directory
  }

  load(): Migration[] {
    return readdirSync(this.directory)
      .filter(file => file.endsWith('.sql'))
      .sort()
      .map(file => parseMigrationFile(file, readFileSync(join(this.directory, file), 'utf8')))
  }
}

export async function readAppliedMigrations(db: Database): Promise<AppliedMigration[]> {
  const table = await getRow<{ found: number }>(
    db,
    'SELECT 1 AS found FROM sqlite_master WHERE type = ? AND name = ?',
    ['table', 'schema_migrations'],
  )
  if (!table) return []
  return getAll<AppliedMigration>(
    db,
    'SELECT version, name, checksum, applied_at AS appliedAt FROM schema_migrations ORDER BY version',
  )
}

export async function currentSchemaVersion(db: Database): Promise<number> {
  return (await readAppliedMigrations(db)).at(-1)?.version ?? 0
}

export class Migrator {
  private readonly db: Database
  private readonly source: MigrationSource

  constructor(db: Database, source: MigrationSource) {
    this.db = db
    this.source = source
  }

  async status(): Promise<MigrationStatus> {
    const available = this.assertContiguous(await this.source.load())
    const applied = await readAppliedMigrations(this.db)
    this.assertHistoryMatches(applied, available)
    return {
      applied,
      pending: available.filter(m => m.version > (applied.at(-1)?.version ?? 0)),
      currentVersion: applied.at(-1)?.version ?? 0,
    }
  }

  /** Applies every pending migration, each in its own write transaction. */
  async migrate(): Promise<Migration[]> {
    const { pending } = await this.status()
    if (pending.length === 0) return []

    await this.ensureTable()
    const applied: Migration[] = []
    for (const migration of pending) {
      if (await this.apply(migration)) applied.push(migration)
    }
    return applied
  }

  private async ensureTable(): Promise<void> {
    await this.db.executeMultiple(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      checksum   TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT`)
  }

  private async apply(migration: Migration): Promise<boolean> {
    return this.db.runInTransaction('write', async () => {
      await this.ensureTable()
      const existing = await getRow<AppliedMigration>(
        this.db,
        'SELECT version, name, checksum, applied_at AS appliedAt FROM schema_migrations WHERE version = ?',
        [migration.version],
      )
      if (existing) {
        if (existing.name !== migration.name || existing.checksum !== checksum(migration.sql)) {
          throw new MigrationError(`Migration ${migration.version}_${migration.name} was modified after being applied. Never edit applied migrations; add a new one.`)
        }
        return false
      }

      await this.db.executeMultiple(migration.sql)
      await runStatement(
        this.db,
        'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)',
        [migration.version, migration.name, checksum(migration.sql), new Date().toISOString()],
      )
      return true
    })
  }

  private assertContiguous(migrations: Migration[]): Migration[] {
    const sorted = [...migrations].sort((a, b) => a.version - b.version)
    sorted.forEach((migration, index) => {
      if (migration.version !== index + 1) {
        throw new MigrationError(`Migration versions must be contiguous from 0001; found ${migration.version} at position ${index + 1}`)
      }
    })
    return sorted
  }

  private assertHistoryMatches(applied: AppliedMigration[], available: Migration[]): void {
    for (const record of applied) {
      const migration = available.find(m => m.version === record.version)
      if (!migration) {
        throw new MigrationError(`Database is at schema v${record.version}, which this version of the app does not know. Upgrade the app or restore an older backup.`)
      }
      if (checksum(migration.sql) !== record.checksum) {
        throw new MigrationError(`Migration ${record.version}_${record.name} was modified after being applied. Never edit applied migrations; add a new one.`)
      }
    }
  }
}
