import { resolve } from 'node:path'
import { DEFAULT_RETENTION } from './backup.ts'
import type { RetentionPolicy } from './backup.ts'

export interface DatabaseConfig {
  databasePath: string
  backupDirectory: string
  retention: RetentionPolicy
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function readDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  return {
    databasePath: resolve(env.NESSIE_DB_PATH ?? '.data/nessie.sqlite'),
    backupDirectory: resolve(env.NESSIE_BACKUP_DIR ?? '.data/backups'),
    retention: {
      keepDaily: positiveInt(env.NESSIE_BACKUP_KEEP_DAILY, DEFAULT_RETENTION.keepDaily),
      keepWeekly: positiveInt(env.NESSIE_BACKUP_KEEP_WEEKLY, DEFAULT_RETENTION.keepWeekly),
    },
  }
}
