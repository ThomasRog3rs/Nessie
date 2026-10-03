import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inTransaction } from './connection.ts'
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

export function readAppliedMigrations(db: Database): AppliedMigration[] {
  const table = db.prepare('SELECT 1 AS found FROM sqlite_master WHERE type = \'table\' AND name = \'schema_migrations\'').get()
  if (!table) return []
  return db.prepare('SELECT version, name, checksum, applied_at AS appliedAt FROM schema_migrations ORDER BY version')
    .all() as unknown as AppliedMigration[]
}

export function currentSchemaVersion(db: Database): number {
  return readAppliedMigrations(db).at(-1)?.version ?? 0
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
    const applied = readAppliedMigrations(this.db)
    this.assertHistoryMatches(applied, available)
    return {
      applied,
      pending: available.filter(m => m.version > (applied.at(-1)?.version ?? 0)),
      currentVersion: applied.at(-1)?.version ?? 0,
    }
  }

  /** Applies every pending migration, each in its own transaction. */
  async migrate(): Promise<Migration[]> {
    const { pending } = await this.status()
    if (pending.length > 0) this.ensureTable()
    for (const migration of pending) this.apply(migration)
    return pending
  }

  private ensureTable(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      checksum   TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT`)
  }

  private apply(migration: Migration): void {
    inTransaction(this.db, () => {
      this.db.exec(migration.sql)
      this.db.prepare('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)')
        .run(migration.version, migration.name, checksum(migration.sql), new Date().toISOString())
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
