# Nesse application

The Nesse application is built with Nuxt 4, Vue 3, TypeScript, Tailwind CSS, and Pinia. The Nuxt project root is this directory.

## Requirements

- Node.js (use the repository's configured Node version, if available)
- npm

## Development

```bash
npm install
npm run dev
```

The development server is available at <http://localhost:3000>.

## Validation and production

```bash
npm run typecheck
npm run build
npm run preview
```

## Structure

- `app/` — Vue application: pages, components, and stores
- `server/api/` — Nuxt server API routes
- `public/` — static public assets

No functional authentication is configured yet.
