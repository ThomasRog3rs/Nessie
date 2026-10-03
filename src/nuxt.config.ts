export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@clerk/nuxt','@nuxt/ui', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  colorMode: { preference: 'light', fallback: 'light' },
  app: {
    head: {
      htmlAttrs: { lang: 'en-GB' },
      title: 'Nesse',
    },
  },
  nitro: {
    serverAssets: [{ baseName: 'migrations', dir: './db/migrations' }],
  },
  typescript: { strict: true },
})
