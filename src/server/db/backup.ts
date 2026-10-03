import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { sqlStringLiteral } from './connection.ts'
import type { Database } from './connection.ts'
import { currentSchemaVersion } from './migrator.ts'

export interface BackupManifest {
  file: string
  createdAt: string
  schemaVersion: number
  sizeBytes: number
  sha256: string
  label: string | null
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

export const DEFAULT_RETENTION: RetentionPolicy = { keepDaily: 14, keepWeekly: 8 }

const MANIFEST_SUFFIX = '.json'

export class BackupError extends Error {}

function sha256OfFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

export function manifestPathFor(backupPath: string): string {
  return `${backupPath}${MANIFEST_SUFFIX}`
}

function timestampForFileName(date: Date): string {
  return date.toISOString().replaceAll(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/** Consistent online snapshot (safe while the server is running) with integrity check and manifest. */
export function createBackup(
  db: Database,
  options: { directory: string, label?: string, now?: Date, retention?: RetentionPolicy },
): BackupManifest {
  const now = options.now ?? new Date()
  const label = options.label ?? null
  const schemaVersion = currentSchemaVersion(db)
  mkdirSync(options.directory, { recursive: true })

  const file = `nessie-${timestampForFileName(now)}-v${schemaVersion}${label ? `-${label}` : ''}.sqlite`
  const finalPath = join(options.directory, file)
  const partialPath = `${finalPath}.partial`
  if (existsSync(finalPath)) throw new BackupError(`Backup already exists: ${file}`)
  rmSync(partialPath, { force: true })

  db.exec(`VACUUM INTO ${sqlStringLiteral(partialPath)}`)
  assertIntegrity(partialPath)
  renameSync(partialPath, finalPath)

  const manifest: BackupManifest = {
    file,
    createdAt: now.toISOString(),
    schemaVersion,
    sizeBytes: statSync(finalPath).size,
    sha256: sha256OfFile(finalPath),
    label,
  }
  writeFileSync(manifestPathFor(finalPath), `${JSON.stringify(manifest, null, 2)}\n`)
  applyRetention(options.directory, options.retention ?? DEFAULT_RETENTION)
  return manifest
}

function assertIntegrity(path: string): void {
  const problems = integrityProblems(path)
  if (problems.length > 0) {
    rmSync(path, { force: true })
    throw new BackupError(`Backup failed integrity check: ${problems.join('; ')}`)
  }
}

function integrityProblems(path: string): string[] {
  const db = new DatabaseSync(path, { readOnly: true })
  try {
    const rows = db.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>
    const foreignKeys = db.prepare('PRAGMA foreign_key_check').all()
    const problems = rows.map(r => r.integrity_check).filter(message => message !== 'ok')
    if (foreignKeys.length > 0) problems.push(`${foreignKeys.length} foreign key violation(s)`)
    return problems
  }
  finally {
    db.close()
  }
}

export function readManifest(backupPath: string): BackupManifest {
  const path = manifestPathFor(backupPath)
  if (!existsSync(path)) throw new BackupError(`Missing manifest: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8')) as BackupManifest
}

export function listBackups(directory: string): BackupManifest[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .filter(name => name.endsWith(`.sqlite${MANIFEST_SUFFIX}`))
    .map(name => JSON.parse(readFileSync(join(directory, name), 'utf8')) as BackupManifest)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function verifyBackup(backupPath: string): BackupVerification {
  const problems: string[] = []
  if (!existsSync(backupPath)) return { ok: false, problems: [`Backup file not found: ${backupPath}`] }
  let manifest: BackupManifest
  try {
    manifest = readManifest(backupPath)
  }
  catch (error) {
    return { ok: false, problems: [(error as Error).message] }
  }
  if (statSync(backupPath).size !== manifest.sizeBytes) problems.push('File size does not match manifest')
  if (sha256OfFile(backupPath) !== manifest.sha256) problems.push('Checksum does not match manifest')
  if (problems.length === 0) problems.push(...integrityProblems(backupPath))
  return { ok: problems.length === 0, manifest, problems }
}

function isoWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNumber = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber)
  const yearStart = Date.UTC(target.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((target.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const SAFETY_BACKUPS_TO_KEEP = 10

/**
 * Chooses which backups to delete (input newest first). Scheduled backups follow the daily/weekly policy;
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

function applyRetention(directory: string, policy: RetentionPolicy): void {
  for (const backup of selectBackupsToPrune(listBackups(directory), policy)) {
    const path = join(directory, backup.file)
    rmSync(path, { force: true })
    rmSync(manifestPathFor(path), { force: true })
  }
}
