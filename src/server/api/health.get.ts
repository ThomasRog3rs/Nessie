import { currentSchemaVersion } from '../db/migrator.ts'
export default defineApiHandler(async () => {
  const { db } = await useRuntime()
  await db.execute('SELECT 1')
  return { status: 'ok', schemaVersion: await currentSchemaVersion(db) }
})
