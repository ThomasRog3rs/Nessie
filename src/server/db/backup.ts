import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { currentSchemaVersion } from './migrator.ts'
import { getAll, getRow, openDatabase, quoteIdentifier, runStatement } from './connection.ts'
import type { Database, SqlExecutor } from './connection.ts'

export interface BackupManifest {
  file: string
  createdAt: string
  schemaVersion: number
  sizeBytes: number
  sha256: string
  label: string | null
  rowCounts: Record<string, number>
  format: 'nessie-logical-backup-v1'
  compression: 'none' | 'gzip'
}

export interface RetentionPolicy {
  /** Keep the newest backup of each of the most recent N days. */
  keepDaily: number
  /** Keep the newest backup of each of the most recent N weeks. */
  keepWeekly: number
}

export interface BackupVerification {
  ok: boolean
  manifest?: BackupManifest
  problems: string[]
}

export interface BackupRecord {
  manifest: BackupManifest
  contents: Uint8Array
}

export interface BackupStore {
  put(name: string, contents: Uint8Array, manifest: BackupManifest): Promise<void>
  get(name: string): Promise<BackupRecord | null>
  list(): Promise<BackupManifest[]>
  delete(name: string): Promise<void>
}

export interface RestoreOptions {
  /** Highest schema version this build understands. */
  supportedSchemaVersion: number
  /** Replace existing user data after making a safety backup. */
  force?: boolean
  retention?: RetentionPolicy
}

export interface RestoreResult {
  restored: BackupManifest
  safetyBackup: BackupManifest | null
}

interface SchemaObjectDump {
  type: 'table' | 'index' | 'trigger' | 'view'
  name: string
  tableName: string
  sql: string
}

interface TableDump {
  name: string
  columns: string[]
  rows: SerializedValue[][]
}

interface BackupPayload {
  format: BackupManifest['format']
  createdAt: string
  schemaVersion: number
  label: string | null
  schemaObjects: SchemaObjectDump[]
  tables: TableDump[]
}

type SerializedValue = null | string | number | { type: 'bigint', value: string } | { type: 'blob', base64: string }

type SqliteMasterRow = { type: SchemaObjectDump['type'], name: string, tbl_name: string, sql: string | null }

type TableInfoRow = { name: string }

type IntegrityRow = { integrity_check: string }

type ForeignKeyViolationRow = { table: string }

export const DEFAULT_RETENTION: RetentionPolicy = { keepDaily: 14, keepWeekly: 8 }

const MANIFEST_SUFFIX = '.manifest.json'
const SAFETY_BACKUPS_TO_KEEP = 10
const BACKUP_FORMAT: BackupManifest['format'] = 'nessie-logical-backup-v1'

export class BackupError extends Error {}

export class FileSystemBackupStore implements BackupStore {
  readonly directory: string

  constructor(directory: string) {
    this.directory = directory
  }

  private manifestPath(name: string): string {
    return join(this.directory, `${name}${MANIFEST_SUFFIX}`)
  }

  private dataPath(name: string): string {
    return join(this.directory, name)
  }

  async put(name: string, contents: Uint8Array, manifest: BackupManifest): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    const dataPath = this.dataPath(name)
    const manifestPath = this.manifestPath(name)
    const partialDataPath = `${dataPath}.partial`
    const partialManifestPath = `${manifestPath}.partial`
    await rm(partialDataPath, { force: true })
    await rm(partialManifestPath, { force: true })
    await writeFile(partialDataPath, contents)
    await writeFile(partialManifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    await rename(partialDataPath, dataPath)
    await rename(partialManifestPath, manifestPath)
  }

  async get(name: string): Promise<BackupRecord | null> {
    try {
      const [contents, manifestRaw] = await Promise.all([
        readFile(this.dataPath(name)),
        readFile(this.manifestPath(name), 'utf8'),
      ])
      return { manifest: JSON.parse(manifestRaw) as BackupManifest, contents }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async list(): Promise<BackupManifest[]> {
    try {
      const files = await readdir(this.directory)
      const manifests = await Promise.all(files
        .filter(name => name.endsWith(MANIFEST_SUFFIX))
        .map(async name => JSON.parse(await readFile(join(this.directory, name), 'utf8')) as BackupManifest))
      return manifests.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  async delete(name: string): Promise<void> {
    await Promise.all([
      rm(this.dataPath(name), { force: true }),
      rm(this.manifestPath(name), { force: true }),
    ])
  }
}

function timestampForFileName(date: Date): string {
  return date.toISOString().replaceAll(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function bufferFromText(text: string): Uint8Array {
  return Buffer.from(text, 'utf8')
}

function payloadBytes(payload: BackupPayload): Uint8Array {
  return bufferFromText(`${JSON.stringify(payload, null, 2)}\n`)
}

function payloadChecksum(payload: BackupPayload): string {
  return createHash('sha256').update(payloadBytes(payload)).digest('hex')
}

function encodeStoredBytes(payload: BackupPayload, compression: BackupManifest['compression']): Uint8Array {
  const bytes = payloadBytes(payload)
  return compression === 'gzip' ? gzipSync(bytes) : bytes
}

function decodeStoredBytes(contents: Uint8Array, compression: BackupManifest['compression']): Uint8Array {
  return compression === 'gzip' ? gunzipSync(contents) : contents
}

function serialiseValue(value: unknown): SerializedValue {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'bigint') return { type: 'bigint', value: value.toString() }
  if (value instanceof ArrayBuffer) return { type: 'blob', base64: Buffer.from(value).toString('base64') }
  throw new BackupError(`Unsupported backup value type: ${typeof value}`)
}

function deserialiseValue(value: SerializedValue): null | string | number | bigint | Uint8Array {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value
  if (value.type === 'bigint') return BigInt(value.value)
  return Buffer.from(value.base64, 'base64')
}

function manifestRowCounts(tables: TableDump[]): Record<string, number> {
  return Object.fromEntries(tables.map(table => [table.name, table.rows.length]))
}

function isoWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNumber = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber)
  const yearStart = Date.UTC(target.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((target.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

async function readSchemaObjects(db: SqlExecutor): Promise<SchemaObjectDump[]> {
  const rows = await getAll<SqliteMasterRow>(
    db,
    `SELECT type, name, tbl_name, sql
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
        AND sql IS NOT NULL
        AND type IN ('table', 'index', 'trigger', 'view')
      ORDER BY CASE type
        WHEN 'table' THEN 0
        WHEN 'index' THEN 1
        WHEN 'trigger' THEN 2
        WHEN 'view' THEN 3
        ELSE 4
      END, name`,
  )
  return rows.map(row => ({ type: row.type, name: row.name, tableName: row.tbl_name, sql: row.sql ?? '' }))
}

async function readTableDump(db: SqlExecutor, tableName: string): Promise<TableDump> {
  const columns = await getAll<TableInfoRow>(db, `PRAGMA table_info(${quoteIdentifier(tableName)})`)
  const rows = await getAll<Record<string, unknown>>(db, `SELECT * FROM ${quoteIdentifier(tableName)}`)
  return {
    name: tableName,
    columns: columns.map(column => column.name),
    rows: rows.map(row => columns.map(column => serialiseValue(row[column.name]))),
  }
}

async function dumpDatabase(db: Database, now: Date, label: string | null): Promise<BackupPayload> {
  return db.runInTransaction('read', async () => {
    const schemaObjects = await readSchemaObjects(db)
    const tables = await Promise.all(schemaObjects
      .filter(object => object.type === 'table')
      .map(object => readTableDump(db, object.name)))

    return {
      format: BACKUP_FORMAT,
      createdAt: now.toISOString(),
      schemaVersion: await currentSchemaVersion(db),
      label,
      schemaObjects,
      tables,
    }
  })
}

function backupFileName(now: Date, schemaVersion: number, label: string | null, compression: BackupManifest['compression']): string {
  const suffix = compression === 'gzip' ? '.json.gz' : '.json'
  return `nessie-${timestampForFileName(now)}-v${schemaVersion}${label ? `-${label}` : ''}${suffix}`
}

async function applyRetention(store: BackupStore, policy: RetentionPolicy): Promise<void> {
  for (const backup of selectBackupsToPrune(await store.list(), policy)) {
    await store.delete(backup.file)
  }
}

function parsePayload(manifest: BackupManifest, contents: Uint8Array): BackupPayload {
  const decoded = decodeStoredBytes(contents, manifest.compression)
  const payload = JSON.parse(Buffer.from(decoded).toString('utf8')) as BackupPayload
  if (payload.format !== BACKUP_FORMAT) throw new BackupError(`Unsupported backup format: ${payload.format}`)
  return payload
}

async function restorePayload(db: Database, payload: BackupPayload): Promise<void> {
  await db.runInTransaction('write', async () => {
    await runStatement(db, 'PRAGMA defer_foreign_keys = ON')
    await dropAllObjects(db)

    const schemaSql = payload.schemaObjects.map(object => object.sql.trim()).filter(Boolean).join(';\n')
    if (schemaSql) await db.executeMultiple(`${schemaSql};`)

    for (const table of payload.tables) {
      if (table.rows.length === 0) continue
      const placeholders = table.columns.map(() => '?').join(', ')
      const insertSql = `INSERT INTO ${quoteIdentifier(table.name)} (${table.columns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders})`
      for (const row of table.rows) {
        await runStatement(db, insertSql, row.map(deserialiseValue))
      }
    }
  })
}

async function dropAllObjects(db: SqlExecutor): Promise<void> {
  const objects = await getAll<SqliteMasterRow>(
    db,
    `SELECT type, name, tbl_name, sql
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
        AND type IN ('trigger', 'view', 'index', 'table')
      ORDER BY CASE type
        WHEN 'trigger' THEN 0
        WHEN 'view' THEN 1
        WHEN 'index' THEN 2
        WHEN 'table' THEN 3
        ELSE 4
      END, name`,
  )
  for (const object of objects) {
    const type = object.type.toUpperCase()
    await db.execute(`DROP ${type} IF EXISTS ${quoteIdentifier(object.name)}`)
  }
}

async function integrityProblems(db: Database): Promise<string[]> {
  const rows = await getAll<IntegrityRow>(db, 'PRAGMA integrity_check')
  const foreignKeys = await getAll<ForeignKeyViolationRow>(db, 'PRAGMA foreign_key_check')
  const problems = rows.map(row => row.integrity_check).filter(message => message !== 'ok')
  if (foreignKeys.length > 0) problems.push(`${foreignKeys.length} foreign key violation(s)`)
  return problems
}

async function validateRestoredPayload(payload: BackupPayload, manifest: BackupManifest): Promise<string[]> {
  const db = await openDatabase('file::memory:')
  try {
    await restorePayload(db, payload)
    const restoredVersion = await currentSchemaVersion(db)
    const problems = await integrityProblems(db)
    if (restoredVersion !== manifest.schemaVersion) {
      problems.push(`Schema version ${restoredVersion} does not match manifest ${manifest.schemaVersion}`)
    }
    for (const [tableName, rowCount] of Object.entries(manifest.rowCounts)) {
      const row = await getRow<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${quoteIdentifier(tableName)}`)
      if ((row?.n ?? 0) !== rowCount) problems.push(`Row count mismatch for ${tableName}`)
    }
    return problems
  }
  finally {
    db.close()
  }
}

export async function databaseHasUserData(db: Database): Promise<boolean> {
  const tables = await getAll<{ name: string }>(
    db,
    `SELECT name FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name != 'schema_migrations'
      ORDER BY name`,
  )

  for (const table of tables) {
    const row = await getRow<{ found: number }>(db, `SELECT 1 AS found FROM ${quoteIdentifier(table.name)} LIMIT 1`)
    if (row) return true
  }
  return false
}

/** Consistent logical snapshot with checksum, manifest and optional gzip compression. */
export async function createBackup(
  db: Database,
  options: { store: BackupStore, label?: string, now?: Date, retention?: RetentionPolicy, gzip?: boolean },
): Promise<BackupManifest> {
  const now = options.now ?? new Date()
  const label = options.label ?? null
  const payload = await dumpDatabase(db, now, label)
  const compression: BackupManifest['compression'] = options.gzip ? 'gzip' : 'none'
  const contents = encodeStoredBytes(payload, compression)
  const manifest: BackupManifest = {
    file: backupFileName(now, payload.schemaVersion, label, compression),
    createdAt: payload.createdAt,
    schemaVersion: payload.schemaVersion,
    sizeBytes: contents.byteLength,
    sha256: payloadChecksum(payload),
    label,
    rowCounts: manifestRowCounts(payload.tables),
    format: BACKUP_FORMAT,
    compression,
  }
  await options.store.put(manifest.file, contents, manifest)
  await applyRetention(options.store, options.retention ?? DEFAULT_RETENTION)
  return manifest
}

export async function listBackups(store: BackupStore): Promise<BackupManifest[]> {
  return store.list()
}

export async function verifyBackup(store: BackupStore, name: string): Promise<BackupVerification> {
  const record = await store.get(name)
  if (!record) return { ok: false, problems: [`Backup file not found: ${name}`] }

  const { manifest, contents } = record
  const problems: string[] = []
  if (contents.byteLength !== manifest.sizeBytes) problems.push('File size does not match manifest')

  let payload: BackupPayload
  try {
    payload = parsePayload(manifest, contents)
  }
  catch (error) {
    return { ok: false, manifest, problems: [(error as Error).message] }
  }

  if (payloadChecksum(payload) !== manifest.sha256) problems.push('Checksum does not match manifest')
  if (payload.createdAt !== manifest.createdAt) problems.push('Created-at does not match manifest')
  if (payload.schemaVersion !== manifest.schemaVersion) problems.push('Schema version does not match manifest')
  if (payload.label !== manifest.label) problems.push('Label does not match manifest')

  const rowCounts = manifestRowCounts(payload.tables)
  for (const [tableName, count] of Object.entries(manifest.rowCounts)) {
    if ((rowCounts[tableName] ?? -1) !== count) problems.push(`Manifest row count mismatch for ${tableName}`)
  }
  for (const tableName of Object.keys(rowCounts)) {
    if (!(tableName in manifest.rowCounts)) problems.push(`Manifest is missing row count for ${tableName}`)
  }

  if (problems.length === 0) problems.push(...await validateRestoredPayload(payload, manifest))
  return { ok: problems.length === 0, manifest, problems }
}

/** Verify → safety-backup the live database → logically restore the chosen backup. */
export async function restoreBackup(
  db: Database,
  store: BackupStore,
  name: string,
  options: RestoreOptions,
): Promise<RestoreResult> {
  const verification = await verifyBackup(store, name)
  if (!verification.ok || !verification.manifest) {
    throw new BackupError(`Refusing to restore an invalid backup: ${verification.problems.join('; ')}`)
  }

  const { manifest } = verification
  if (manifest.schemaVersion > options.supportedSchemaVersion) {
    throw new BackupError(`Backup is schema v${manifest.schemaVersion} but this app supports up to v${options.supportedSchemaVersion}.`)
  }

  const hasData = await databaseHasUserData(db)
  if (hasData && !options.force) {
    throw new BackupError('The database is not empty. Pass --force to replace existing data.')
  }

  let safetyBackup: BackupManifest | null = null
  if (hasData) {
    safetyBackup = await createBackup(db, {
      store,
      label: 'pre-restore',
      retention: options.retention,
    })
  }

  const record = await store.get(name)
  if (!record) throw new BackupError(`Backup file not found: ${name}`)
  await restorePayload(db, parsePayload(record.manifest, record.contents))
  return { restored: manifest, safetyBackup }
}

/** Chooses which backups to delete (input newest first). Scheduled backups follow the daily/weekly policy;
 * labelled safety backups (pre-migration, pre-restore) are kept separately so they never evict, or get evicted by, scheduled ones.
 */
export function selectBackupsToPrune(backups: BackupManifest[], policy: RetentionPolicy): BackupManifest[] {
  const keep = new Set<string>()
  const mark = (candidates: BackupManifest[], keyOf: (b: BackupManifest) => string, limit: number) => {
    const seen = new Set<string>()
    for (const backup of candidates) {
      const key = keyOf(backup)
      if (seen.has(key)) continue
      if (seen.size >= limit) break
      seen.add(key)
      keep.add(backup.file)
    }
  }
  const scheduled = backups.filter(b => b.label === null)
  mark(scheduled, b => b.createdAt.slice(0, 10), policy.keepDaily)
  mark(scheduled, b => isoWeekKey(new Date(b.createdAt)), policy.keepWeekly)
  backups.filter(b => b.label !== null).slice(0, SAFETY_BACKUPS_TO_KEEP).forEach(b => keep.add(b.file))
  return backups.filter(b => !keep.has(b.file))
}

export async function storedBackupSize(store: BackupStore, name: string): Promise<number | null> {
  if (store instanceof FileSystemBackupStore) {
    try {
      return (await stat(join(store.directory, name))).size
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }
  const record = await store.get(name)
  return record?.contents.byteLength ?? null
}
