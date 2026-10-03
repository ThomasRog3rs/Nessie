import type { Config } from '@netlify/functions'
import { createBackup } from '../../server/db/backup.ts'
import { createBackupStore } from '../../server/db/backupStoreFactory.ts'
import { readDatabaseConfig } from '../../server/db/config.ts'
import { openDatabase } from '../../server/db/connection.ts'

/** Nightly logical backup of the production database into Netlify Blobs, with daily/weekly retention. */
export default async () => {
  const config = readDatabaseConfig({ ...process.env, NESSIE_BACKUP_STORE: 'netlify-blobs' })
  const db = await openDatabase(config.databaseUrl, config.databaseAuthToken)
  try {
    const manifest = await createBackup(db, { store: createBackupStore(config), label: 'scheduled', retention: config.retention, gzip: true })
    console.info(`[backup] ${manifest.file} (${manifest.sizeBytes} bytes)`)
  }
  finally {
    db.close()
  }
}

export const config: Config = { schedule: '0 3 * * *' }
