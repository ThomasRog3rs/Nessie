import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createBackup, FileSystemBackupStore, listBackups, restoreBackup, selectBackupsToPrune, verifyBackup,
} from '../server/db/backup.ts'
import type { BackupManifest } from '../server/db/backup.ts'
import { openAndMigrate } from '../server/db/bootstrap.ts'
import { getRow, openDatabase } from '../server/db/connection.ts'
import { seedDatabase } from '../server/db/seed.ts'
import { migrationSource, TODAY } from './helpers.ts'

describe('backup and restore', () => {
  let dir: string
  let databaseUrl: string
  let backupStore: FileSystemBackupStore

  beforeEach(() => {
    dir = resolve(import.meta.dirname, '.test-artifacts', `backup-${crypto.randomUUID()}`)
    mkdirSync(dir, { recursive: true })
    databaseUrl = `file:${join(dir, 'nessie.sqlite')}`
    backupStore = new FileSystemBackupStore(join(dir, 'backups'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const open = () => openAndMigrate({ databaseUrl, backupStore, source: migrationSource })
  const countSitters = async (db: Awaited<ReturnType<typeof open>>['db']) =>
    (await getRow<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM sitters'))!.n
  const supportedSchemaVersion = async () => (await migrationSource.load()).at(-1)?.version ?? 0

  it('round-trips: backup, change, restore', async () => {
    const { db } = await open()
    await seedDatabase(db, TODAY)
    const manifest = await createBackup(db, { store: backupStore })
    await db.executeMultiple('DELETE FROM booking_history; DELETE FROM booking_pets; DELETE FROM booking_services; DELETE FROM bookings; DELETE FROM sitters;')
    db.close()
    expect((await verifyBackup(backupStore, manifest.file)).ok).toBe(true)

    const live = await openDatabase(databaseUrl)
    const result = await restoreBackup(live, backupStore, manifest.file, { supportedSchemaVersion: await supportedSchemaVersion(), force: true })
    live.close()
    expect(result.safetyBackup?.label).toBe('pre-restore')

    const restored = await open()
    expect(await countSitters(restored.db)).toBe(1)
    restored.db.close()
  })

  it('detects a tampered backup and refuses to restore it', async () => {
    const { db } = await open()
    const manifest = await createBackup(db, { store: backupStore })
    db.close()
    const path = join(backupStore.directory, manifest.file)
    writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from('x')]))
    expect((await verifyBackup(backupStore, manifest.file)).ok).toBe(false)
    const live = await openDatabase(databaseUrl)
    await expect(restoreBackup(live, backupStore, manifest.file, { supportedSchemaVersion: await supportedSchemaVersion() })).rejects.toThrow(/invalid backup/)
    live.close()
  })

  it('refuses a backup from a newer schema', async () => {
    const { db } = await open()
    const manifest = await createBackup(db, { store: backupStore })
    db.close()
    const live = await openDatabase(databaseUrl)
    await expect(restoreBackup(live, backupStore, manifest.file, { supportedSchemaVersion: 0 })).rejects.toThrow(/supports up to/)
    live.close()
  })

  it('snapshots before applying migrations to existing data', async () => {
    const { db } = await open()
    await seedDatabase(db, TODAY)
    db.close()
    const migrations = await migrationSource.load()
    const latestVersion = migrations.at(-1)?.version ?? 0
    const second = await openAndMigrate({
      databaseUrl,
      backupStore,
      source: { load: async () => [...(await migrationSource.load()), { version: latestVersion + 1, name: 'extra', sql: 'CREATE TABLE extra (id INTEGER) STRICT' }] },
    })
    second.db.close()
    expect(second.preMigrationBackup?.label).toBe('pre-migration')
    expect(await listBackups(backupStore)).toHaveLength(1)
  })

  it('retains the newest backup per day and week', () => {
    const at = (iso: string): BackupManifest => ({
      file: iso,
      createdAt: iso,
      schemaVersion: 1,
      sizeBytes: 1,
      sha256: '',
      label: null,
      rowCounts: {},
      format: 'nessie-logical-backup-v1',
      compression: 'none',
    })
    const backups = [at('2030-01-10T12:00:00Z'), at('2030-01-10T08:00:00Z'), at('2030-01-09T08:00:00Z'), at('2030-01-02T08:00:00Z')]
    const pruned = selectBackupsToPrune(backups, { keepDaily: 2, keepWeekly: 1 }).map(b => b.file)
    expect(pruned).toEqual(['2030-01-10T08:00:00Z', '2030-01-02T08:00:00Z'])
  })
})
