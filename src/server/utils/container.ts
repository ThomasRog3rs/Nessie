import { NitroMigrationSource } from './migrationAssets.ts'
import { readDatabaseConfig } from '../db/config.ts'
import type { Database } from '../db/connection.ts'
import { openAndMigrate } from '../db/bootstrap.ts'
import { isSeeded, seedDatabase } from '../db/seed.ts'
import { createServices } from '../services/composition.ts'
import type { AppServices } from '../services/composition.ts'
import { todayInTimeZone } from '../../shared/utils/dateRange.ts'

interface Runtime {
  db: Database
  services: AppServices
}

let runtime: Promise<Runtime> | undefined

async function start(): Promise<Runtime> {
  const config = readDatabaseConfig()
  const { db, applied, preMigrationBackup } = await openAndMigrate({ ...config, source: new NitroMigrationSource() })
  if (preMigrationBackup) console.info(`[db] pre-migration backup: ${preMigrationBackup.file}`)
  if (applied.length > 0) console.info(`[db] applied migrations: ${applied.map(m => m.version).join(', ')}`)

  const seedOnEmpty = process.env.NESSIE_SEED_ON_EMPTY ?? (import.meta.dev ? 'true' : 'false')
  if (seedOnEmpty === 'true' && !isSeeded(db)) {
    seedDatabase(db, todayInTimeZone('Europe/London'))
    console.info('[db] seeded demo data')
  }
  return { db, services: createServices(db) }
}

export function useRuntime(): Promise<Runtime> {
  runtime ??= start().catch((error) => {
    runtime = undefined
    throw error
  })
  return runtime
}

export async function useServices(): Promise<AppServices> {
  return (await useRuntime()).services
}

export async function closeRuntime(): Promise<void> {
  if (!runtime) return
  const { db } = await runtime
  db.close()
  runtime = undefined
}
