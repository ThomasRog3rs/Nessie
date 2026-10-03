// Opens and migrates the database at startup so a bad migration fails fast, and closes it on shutdown.
export default defineNitroPlugin(async (nitro) => {
  await useRuntime()
  nitro.hooks.hook('close', () => closeRuntime())
})
