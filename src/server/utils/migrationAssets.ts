import { parseMigrationFile } from '../db/migrator.ts'
import type { Migration, MigrationSource } from '../db/migrator.ts'

/** Reads migrations bundled as Nitro server assets, so they ship with the production build. */
export class NitroMigrationSource implements MigrationSource {
  async load(): Promise<Migration[]> {
    const storage = useStorage('assets:migrations')
    const files = (await storage.getKeys()).filter(key => key.endsWith('.sql')).sort()
    if (files.length === 0) throw new Error('No migrations found in the bundled server assets')
    return Promise.all(files.map(async (file) => {
      const sql = await storage.getItemRaw<string | Uint8Array>(file)
      return parseMigrationFile(file, typeof sql === 'string' ? sql : new TextDecoder().decode(sql ?? new Uint8Array()))
    }))
  }
}
