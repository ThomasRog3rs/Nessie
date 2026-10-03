import { createBackup, databaseHasUserData } from './backup.ts'
import type { BackupManifest, BackupStore, RetentionPolicy } from './backup.ts'
import { openDatabase } from './connection.ts'
import type { Database } from './connection.ts'
import { Migrator } from './migrator.ts'
import type { Migration, MigrationSource } from './migrator.ts'

export interface BootstrapOptions {
  databaseUrl: string
  databaseAuthToken?: string
  backupStore: BackupStore
  retention?: RetentionPolicy
  source: MigrationSource
}

export interface BootstrapResult {
  db: Database
  applied: Migration[]
  preMigrationBackup: BackupManifest | null
}

/** Opens the database and brings it to the latest schema, snapshotting first if existing data will change. */
export async function openAndMigrate(options: BootstrapOptions): Promise<BootstrapResult> {
  const db = await openDatabase(options.databaseUrl, options.databaseAuthToken)
  try {
    const migrator = new Migrator(db, options.source)
    const { pending, currentVersion } = await migrator.status()
    const preMigrationBackup = pending.length > 0 && currentVersion > 0 && await databaseHasUserData(db)
      ? await createBackup(db, { store: options.backupStore, label: 'pre-migration', retention: options.retention })
      : null
    const applied = await migrator.migrate()
    return { db, applied, preMigrationBackup }
  }
  catch (error) {
    db.close()
    throw error
  }
}
