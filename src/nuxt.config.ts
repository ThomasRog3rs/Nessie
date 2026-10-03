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
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png', sizes: '128x128' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: '32x32' },
      ],
    },
  },
  nitro: {
    serverAssets: [{ baseName: 'migrations', dir: './db/migrations' }],
  },
  typescript: { strict: true },
})
