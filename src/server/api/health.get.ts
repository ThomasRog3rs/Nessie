import { currentSchemaVersion } from '../db/migrator.ts'
export default defineApiHandler(async () => {
  const { db } = await useRuntime()
  db.prepare('SELECT 1').get()
  return { status: 'ok', schemaVersion: currentSchemaVersion(db) }
})
