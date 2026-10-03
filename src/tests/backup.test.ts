import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackup, listBackups, selectBackupsToPrune, verifyBackup } from '../server/db/backup.ts'
import type { BackupManifest } from '../server/db/backup.ts'
import { openAndMigrate } from '../server/db/bootstrap.ts'
import { restoreBackup } from '../server/db/restore.ts'
import { seedDatabase } from '../server/db/seed.ts'
import { migrationSource, TODAY } from './helpers.ts'

describe('backup and restore', () => {
  let dir: string
  let databasePath: string
  let backupDirectory: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nessie-'))
    databasePath = join(dir, 'nessie.sqlite')
    backupDirectory = join(dir, 'backups')
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const open = () => openAndMigrate({ databasePath, backupDirectory, source: migrationSource })
  const countSitters = (db: Awaited<ReturnType<typeof open>>['db']) =>
    (db.prepare('SELECT COUNT(*) AS n FROM sitters').get() as { n: number }).n

  it('round-trips: backup, change, restore', async () => {
    const { db } = await open()
    seedDatabase(db, TODAY)
    const manifest = createBackup(db, { directory: backupDirectory })
    db.exec('DELETE FROM booking_history; DELETE FROM booking_pets; DELETE FROM booking_services; DELETE FROM bookings; DELETE FROM sitters;')
    db.close()
    expect(verifyBackup(join(backupDirectory, manifest.file)).ok).toBe(true)

    const result = restoreBackup({ backupPath: join(backupDirectory, manifest.file), databasePath, backupDirectory, supportedSchemaVersion: 1 })
    expect(result.safetyBackup?.label).toBe('pre-restore')

    const restored = await open()
    expect(countSitters(restored.db)).toBe(1)
    restored.db.close()
  })

  it('detects a tampered backup and refuses to restore it', async () => {
    const { db } = await open()
    const manifest = createBackup(db, { directory: backupDirectory })
    db.close()
    const path = join(backupDirectory, manifest.file)
    writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from('x')]))
    expect(verifyBackup(path).ok).toBe(false)
    expect(() => restoreBackup({ backupPath: path, databasePath, backupDirectory, supportedSchemaVersion: 1 })).toThrow(/invalid backup/)
  })

  it('refuses a backup from a newer schema', async () => {
    const { db } = await open()
    const manifest = createBackup(db, { directory: backupDirectory })
    db.close()
    expect(() => restoreBackup({ backupPath: join(backupDirectory, manifest.file), databasePath, backupDirectory, supportedSchemaVersion: 0 }))
      .toThrow(/supports up to/)
  })

  it('snapshots before applying migrations to existing data', async () => {
    const { db } = await open()
    db.close()
    const second = await openAndMigrate({
      databasePath, backupDirectory,
      source: { load: async () => [...(await migrationSource.load()), { version: 2, name: 'extra', sql: 'CREATE TABLE extra (id INTEGER) STRICT' }] },
    })
    second.db.close()
    expect(second.preMigrationBackup?.label).toBe('pre-migration')
    expect(listBackups(backupDirectory)).toHaveLength(1)
  })

  it('retains the newest backup per day and week', () => {
    const at = (iso: string): BackupManifest => ({ file: iso, createdAt: iso, schemaVersion: 1, sizeBytes: 1, sha256: '', label: null })
    const backups = [at('2030-01-10T12:00:00Z'), at('2030-01-10T08:00:00Z'), at('2030-01-09T08:00:00Z'), at('2030-01-02T08:00:00Z')]
    const pruned = selectBackupsToPrune(backups, { keepDaily: 2, keepWeekly: 1 }).map(b => b.file)
    expect(pruned).toEqual(['2030-01-10T08:00:00Z', '2030-01-02T08:00:00Z'])
  })
})
