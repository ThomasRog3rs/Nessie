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

## Booking flow (booker side)

Pages: `/book` (dates and times) → `/book/details` → `/book/review` → `/bookings/:id`; `/bookings` lists requests.

The sitter is mocked and every date is bookable (apart from nights held by an active booking). The frontend only talks to the backend through `app/composables/useBookingApi.ts`; request/response shapes are in `shared/types/booking.ts`. Money is integer pence, dates are `yyyy-mm-dd`, times are `HH:mm` in the property's timezone.

Stub endpoints in `server/api/` use an in-memory store (`server/utils/bookingStore.ts`) and should be replaced by the real backend:

- `GET /api/sitters/current`
- `GET /api/sitters/current/availability?from=&to=`
- `GET /api/bookings`, `POST /api/bookings`
- `GET /api/bookings/:id`, `POST /api/bookings/:id/cancel`

No functional authentication is configured yet.
