import { FileSystemBackupStore } from './backup.ts'
import type { BackupStore } from './backup.ts'
import { NetlifyBlobBackupStore } from './blobBackupStore.ts'
import type { DatabaseConfig } from './config.ts'

/** Filesystem by default; Netlify Blobs when NESSIE_BACKUP_STORE=netlify-blobs (production). */
export function createBackupStore(config: Pick<DatabaseConfig, 'backupDirectory' | 'backupStore'>): BackupStore {
  return config.backupStore === 'netlify-blobs'
    ? new NetlifyBlobBackupStore()
    : new FileSystemBackupStore(config.backupDirectory)
}
