// Database operations CLI. Run via the `db:*` npm scripts (Node 24 runs TypeScript natively).
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  createBackup, listBackups, restoreBackup, verifyBackup,
} from '../../server/db/backup.ts'
import { createBackupStore } from '../../server/db/backupStoreFactory.ts'
import { readDatabaseConfig } from '../../server/db/config.ts'
import { openDatabase } from '../../server/db/connection.ts'
import { openAndMigrate } from '../../server/db/bootstrap.ts'
import { FileMigrationSource, Migrator } from '../../server/db/migrator.ts'
import { clearData, isSeeded, seedCleanDatabase, seedDatabase } from '../../server/db/seed.ts'
import { todayInTimeZone } from '../../shared/utils/dateRange.ts'

const config = readDatabaseConfig()
const backupStore = createBackupStore(config)
const source = new FileMigrationSource(resolve(dirname(fileURLToPath(import.meta.url)), '../../server/db/migrations'))

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { force: { type: 'boolean', default: false }, reset: { type: 'boolean', default: false }, clean: { type: 'boolean', default: false } },
})
const [command, argument] = positionals

function backupNameFromArgument(value: string | undefined): string {
  if (!value) throw new Error('Missing backup file name')
  return value.split(/[\\/]/).at(-1) ?? value
}

const commands: Record<string, () => Promise<void> | void> = {
  async migrate() {
    const { db, applied, preMigrationBackup } = await openAndMigrate({ ...config, backupStore, source })
    db.close()
    if (preMigrationBackup) console.log(`Pre-migration backup: ${preMigrationBackup.file}`)
    console.log(applied.length ? `Applied: ${applied.map(m => `${m.version}_${m.name}`).join(', ')}` : 'Database is up to date.')
  },

  async status() {
    const db = await openDatabase(config.databaseUrl, config.databaseAuthToken)
    try {
      const status = await new Migrator(db, source).status()
      console.log(`Schema version: ${status.currentVersion}`)
      status.applied.forEach(m => console.log(`  applied  ${m.version}_${m.name}  ${m.appliedAt}`))
      status.pending.forEach(m => console.log(`  pending  ${m.version}_${m.name}`))
    }
    finally {
      db.close()
    }
  },

  async backup() {
    const { db } = await openAndMigrate({ ...config, backupStore, source })
    try {
      const manifest = await createBackup(db, { store: backupStore, retention: config.retention })
      console.log(`Backup written: ${manifest.file} (${manifest.sizeBytes} bytes, schema v${manifest.schemaVersion})`)
    }
    finally {
      db.close()
    }
  },

  async list() {
    const backups = await listBackups(backupStore)
    if (backups.length === 0) console.log('No backups found.')
    backups.forEach(b => console.log(`${b.file}  v${b.schemaVersion}  ${b.createdAt}`))
  },

  async verify() {
    const result = await verifyBackup(backupStore, backupNameFromArgument(argument))
    if (!result.ok) throw new Error(`Backup is NOT valid: ${result.problems.join('; ')}`)
    console.log(`OK: ${result.manifest!.file} (schema v${result.manifest!.schemaVersion})`)
  },

  async restore() {
    const migrations = await source.load()
    const db = await openDatabase(config.databaseUrl, config.databaseAuthToken)
    try {
      const result = await restoreBackup(db, backupStore, backupNameFromArgument(argument), {
        supportedSchemaVersion: migrations.at(-1)?.version ?? 0,
        force: values.force,
        retention: config.retention,
      })
      console.log(`Restored ${result.restored.file}.`)
      if (result.safetyBackup) console.log(`Previous database saved as ${result.safetyBackup.file}.`)
    }
    finally {
      db.close()
    }
    await commands.migrate!()
  },

  async seed() {
    const { db } = await openAndMigrate({ ...config, backupStore, source })
    try {
      if (await isSeeded(db)) {
        if (!values.reset) throw new Error('Database already has data. Pass --reset to replace it (take a backup first).')
        await clearData(db)
      }
      if (values.clean) {
        await seedCleanDatabase(db)
        console.log('Seeded a bare sitter (Thomas Rogers, name only) and a demo booker with no bookings.')
      }
      else {
        await seedDatabase(db, todayInTimeZone('Europe/London'))
        console.log('Seeded sitter Thomas Rogers, a demo booker, blocked dates and sample bookings.')
      }
    }
    finally {
      db.close()
    }
  },
}

const run = command ? commands[command] : undefined
if (!run) {
  console.error(`Usage: db <${Object.keys(commands).join('|')}> [argument] [--force] [--reset] [--clean]`)
  process.exit(1)
}
try {
  await run()
}
catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
