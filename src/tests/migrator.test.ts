import { describe, expect, it } from 'vitest'
import { getRow, openDatabase } from '../server/db/connection.ts'
import { Migrator } from '../server/db/migrator.ts'
import type { Migration, MigrationSource } from '../server/db/migrator.ts'
import { migrationSource } from './helpers.ts'

const sourceOf = (...migrations: Migration[]): MigrationSource => ({ load: () => migrations })
const create = (version: number, sql: string): Migration => ({ version, name: `m${version}`, sql })

describe('Migrator', () => {
  it('applies the real migrations once and is idempotent', async () => {
    const db = await openDatabase('file::memory:')
    const migrator = new Migrator(db, migrationSource)
    expect((await migrator.migrate()).length).toBeGreaterThan(0)
    expect(await migrator.migrate()).toEqual([])
    expect((await migrator.status()).pending).toEqual([])
  })

  it('rolls back a failing migration and records nothing', async () => {
    const db = await openDatabase('file::memory:')
    const migrator = new Migrator(db, sourceOf(create(1, 'CREATE TABLE a (id INTEGER); THIS IS NOT SQL;')))
    await expect(migrator.migrate()).rejects.toThrow()
    expect(await getRow<{ name: string }>(db, 'SELECT name FROM sqlite_master WHERE name = ?', ['a'])).toBeUndefined()
  })

  it('refuses to run when an applied migration was edited', async () => {
    const db = await openDatabase('file::memory:')
    await new Migrator(db, sourceOf(create(1, 'CREATE TABLE a (id INTEGER)'))).migrate()
    const edited = new Migrator(db, sourceOf(create(1, 'CREATE TABLE a (id INTEGER, extra TEXT)')))
    await expect(edited.migrate()).rejects.toThrow(/modified after being applied/)
  })

  it('refuses a database newer than the app', async () => {
    const db = await openDatabase('file::memory:')
    await new Migrator(db, sourceOf(create(1, 'SELECT 1'), create(2, 'SELECT 1'))).migrate()
    await expect(new Migrator(db, sourceOf(create(1, 'SELECT 1'))).status()).rejects.toThrow(/does not know/)
  })

  it('rejects gaps in migration versions', async () => {
    const db = await openDatabase('file::memory:')
    await expect(new Migrator(db, sourceOf(create(1, 'SELECT 1'), create(3, 'SELECT 1'))).status()).rejects.toThrow(/contiguous/)
  })
})
