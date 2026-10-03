import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs'
import { BackupError, createBackup, verifyBackup } from './backup.ts'
import type { BackupManifest } from './backup.ts'
import { openDatabase } from './connection.ts'

export interface RestoreOptions {
  backupPath: string
  databasePath: string
  backupDirectory: string
  /** Highest schema version this build understands. */
  supportedSchemaVersion: number
  /** Skip the check that nothing else is using the database. */
  force?: boolean
}

export interface RestoreResult {
  restored: BackupManifest
  safetyBackup: BackupManifest | null
}

function assertDatabaseIdle(databasePath: string): void {
  const db = openDatabase(databasePath)
  try {
    db.exec('BEGIN EXCLUSIVE')
    db.exec('ROLLBACK')
  }
  catch {
    throw new BackupError('The database is in use. Stop the Nesse server first (or pass --force).')
  }
  finally {
    db.close()
  }
}

/** Verify → safety-backup the live database → atomically swap in the chosen backup. */
export function restoreBackup(options: RestoreOptions): RestoreResult {
  const verification = verifyBackup(options.backupPath)
  if (!verification.ok || !verification.manifest) {
    throw new BackupError(`Refusing to restore an invalid backup: ${verification.problems.join('; ')}`)
  }
  const { manifest } = verification
  if (manifest.schemaVersion > options.supportedSchemaVersion) {
    throw new BackupError(`Backup is schema v${manifest.schemaVersion} but this app supports up to v${options.supportedSchemaVersion}.`)
  }

  let safetyBackup: BackupManifest | null = null
  if (existsSync(options.databasePath)) {
    if (!options.force) assertDatabaseIdle(options.databasePath)
    const live = openDatabase(options.databasePath)
    try {
      safetyBackup = createBackup(live, { directory: options.backupDirectory, label: 'pre-restore' })
    }
    finally {
      live.close()
    }
  }

  const stagingPath = `${options.databasePath}.restoring`
  copyFileSync(options.backupPath, stagingPath)
  renameSync(stagingPath, options.databasePath)
  rmSync(`${options.databasePath}-wal`, { force: true })
  rmSync(`${options.databasePath}-shm`, { force: true })
  return { restored: manifest, safetyBackup }
}
