import { resolve } from 'node:path'
import { DEFAULT_RETENTION } from './backup.ts'
import type { RetentionPolicy } from './backup.ts'

export interface DatabaseConfig {
  databaseUrl: string
  databaseAuthToken?: string
  backupDirectory: string
  backupStore: 'filesystem' | 'netlify-blobs'
  retention: RetentionPolicy
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function readDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  return {
    databaseUrl: env.NESSIE_DATABASE_URL ?? 'file:.data/nessie.sqlite',
    databaseAuthToken: env.NESSIE_DATABASE_AUTH_TOKEN,
    backupDirectory: resolve(env.NESSIE_BACKUP_DIR ?? '.data/backups'),
    backupStore: env.NESSIE_BACKUP_STORE === 'netlify-blobs' ? 'netlify-blobs' : 'filesystem',
    retention: {
      keepDaily: positiveInt(env.NESSIE_BACKUP_KEEP_DAILY, DEFAULT_RETENTION.keepDaily),
      keepWeekly: positiveInt(env.NESSIE_BACKUP_KEEP_WEEKLY, DEFAULT_RETENTION.keepWeekly),
    },
  }
}
