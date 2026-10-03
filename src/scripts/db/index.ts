// Database operations CLI. Run via the `db:*` npm scripts (Node 24 runs TypeScript natively).
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createBackup, listBackups, verifyBackup } from '../../server/db/backup.ts'
import { readDatabaseConfig } from '../../server/db/config.ts'
import { openDatabase } from '../../server/db/connection.ts'
import { openAndMigrate } from '../../server/db/bootstrap.ts'
import { FileMigrationSource, Migrator } from '../../server/db/migrator.ts'
import { restoreBackup } from '../../server/db/restore.ts'
import { clearData, isSeeded, seedDatabase } from '../../server/db/seed.ts'
import { todayInTimeZone } from '../../shared/utils/dateRange.ts'

const config = readDatabaseConfig()
const source = new FileMigrationSource(resolve(dirname(fileURLToPath(import.meta.url)), '../../server/db/migrations'))

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { force: { type: 'boolean', default: false }, reset: { type: 'boolean', default: false } },
})
const [command, argument] = positionals

const commands: Record<string, () => Promise<void> | void> = {
  async migrate() {
    const { db, applied, preMigrationBackup } = await openAndMigrate({ ...config, source })
    db.close()
    if (preMigrationBackup) console.log(`Pre-migration backup: ${preMigrationBackup.file}`)
    console.log(applied.length ? `Applied: ${applied.map(m => `${m.version}_${m.name}`).join(', ')}` : 'Database is up to date.')
  },

  async status() {
    mkdirSync(dirname(config.databasePath), { recursive: true })
    const db = openDatabase(config.databasePath)
    const status = await new Migrator(db, source).status()
    db.close()
    console.log(`Schema version: ${status.currentVersion}`)
    status.applied.forEach(m => console.log(`  applied  ${m.version}_${m.name}  ${m.appliedAt}`))
    status.pending.forEach(m => console.log(`  pending  ${m.version}_${m.name}`))
  },

  async backup() {
    const { db } = await openAndMigrate({ ...config, source })
    const manifest = createBackup(db, { directory: config.backupDirectory, retention: config.retention })
    db.close()
    console.log(`Backup written: ${manifest.file} (${manifest.sizeBytes} bytes, schema v${manifest.schemaVersion})`)
  },

  list() {
    const backups = listBackups(config.backupDirectory)
    if (backups.length === 0) console.log('No backups found.')
    backups.forEach(b => console.log(`${b.file}  v${b.schemaVersion}  ${b.createdAt}`))
  },

  verify() {
    if (!argument) throw new Error('Usage: db:verify <backup-file>')
    const result = verifyBackup(resolve(argument))
    if (!result.ok) throw new Error(`Backup is NOT valid: ${result.problems.join('; ')}`)
    console.log(`OK: ${result.manifest!.file} (schema v${result.manifest!.schemaVersion})`)
  },

  async restore() {
    if (!argument) throw new Error('Usage: db:restore <backup-file> [--force]')
    const migrations = await source.load()
    const result = restoreBackup({
      backupPath: resolve(argument),
      databasePath: config.databasePath,
      backupDirectory: config.backupDirectory,
      supportedSchemaVersion: migrations.at(-1)?.version ?? 0,
      force: values.force,
    })
    console.log(`Restored ${result.restored.file}.`)
    if (result.safetyBackup) console.log(`Previous database saved as ${result.safetyBackup.file}.`)
    await commands.migrate!()
  },

  async seed() {
    const { db } = await openAndMigrate({ ...config, source })
    try {
      if (isSeeded(db)) {
        if (!values.reset) throw new Error('Database already has data. Pass --reset to replace it (take a backup first).')
        clearData(db)
      }
      seedDatabase(db, todayInTimeZone('Europe/London'))
      console.log('Seeded sitter Thomas Rogers, a demo booker, blocked dates and sample bookings.')
    }
    finally {
      db.close()
    }
  },
}

const run = command ? commands[command] : undefined
if (!run) {
  console.error(`Usage: db <${Object.keys(commands).join('|')}> [argument] [--force] [--reset]`)
  process.exit(1)
}
try {
  await run()
}
catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
