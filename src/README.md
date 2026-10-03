# Nesse application

Nuxt 4 + Vue 3 + TypeScript + Tailwind + Pinia, backed by SQLite (Node's built-in `node:sqlite`). The Nuxt project root is this directory. Auth is not implemented yet: a mock actor provider resolves the booker (`booker-demo`) and the sitter (**Thomas Rogers**, `sitter-thomas-rogers`).

## Requirements

- Node.js 24+ (see `.nvmrc`), npm

## Development

```bash
npm install
npm run dev          # http://localhost:3000, auto-migrates and seeds an empty DB
npm test             # vitest
npm run typecheck
npm run build && npm run preview
```

## Architecture

```
routes (server/api)  ->  services (server/services)  ->  repository contracts (server/repositories/contracts.ts)
                                                              ^ implemented by server/repositories/sqlite/*
```

- `shared/schemas` — zod schemas shared by server validation and the UI; `shared/types` are inferred from them.
- `server/domain` — domain errors and the booking state machine.
- `server/services` — business rules (availability, booking lifecycle, blocks). Depend only on interfaces.
- `server/utils/container.ts` — composition root; `server/plugins/database.ts` runs migrations on startup.
- `server/db` — connection, migrator, backup, restore, seed, SQL migrations.
- `app/composables/useBookingApi.ts`, `useSitterApi.ts` — typed API clients.

Conventions: dates `yyyy-mm-dd`, times `HH:mm`, instants ISO UTC, money in integer pence. A booking occupies nights `[start, end)`; availability blocks are inclusive ranges. Dates with no block or active booking are available; `booked` wins over `unavailable`.

### Frontend workspaces

- Booker pages use `/book` and `/bookings/*`.
- Sitter pages use the separate `/sitter/*` route group and the `sitter` layout: overview, requests, bookings, availability, and profile.
- Sitter pages use the typed `/api/sitters/current/*` endpoints for persistent profiles, requests, bookings, availability, progress updates, expenses and photos. The current actor remains the development mock sitter; authentication is not implemented.
- Property access instructions, emergency instructions and contact/veterinary details are omitted from sitter booking responses until the booking is confirmed or completed. Requested handover times remain separate from the agreed times.
- Booking photos and receipts are stored outside SQLite in a private local directory. They are available only through an ownership-checked booking attachment route; their filesystem paths are never returned. The local filesystem adapter is intended for development or a single-node deployment with a persistent private volume.
- Attachments are limited to one upload per request and 10 MiB per file. Receipts allow PDF/JPG/PNG; photos allow JPG/PNG/WebP. MIME types and file signatures are checked server-side.
- Expenses and attachments are records/evidence only. There is no invoice generation, payment, reimbursement settlement, payable total, attendance verification or profile image storage.

## API

Booker: `GET /api/sitters/current`, `GET /api/sitters/current/availability?from=&to=`, `GET|POST /api/bookings`, `GET /api/bookings/:id`, `POST /api/bookings/:id/cancel`.

Sitter endpoints reused: `GET|POST /api/sitters/current/blocks`, `PATCH|DELETE /api/sitters/current/blocks/:id`, `GET /api/sitters/current/bookings`, and `POST /api/sitters/current/bookings/:id/{accept,decline,times,cancel,complete}`. Booking decisions continue to use the existing state machine; availability blocks remain inclusive and cannot overlap a date-holding booking.

Sitter endpoints added: `GET|PATCH /api/sitters/current/profile`; `GET /api/sitters/current/bookings/:id`; `POST /api/sitters/current/bookings/:id/updates`; `POST /api/sitters/current/bookings/:id/expenses` (multipart fields `category`, `description`, integer-pence `amount`, optional `file` receipt); `POST /api/sitters/current/bookings/:id/expenses/:expenseId/receipt`; `POST /api/sitters/current/bookings/:id/attachments` (multipart `file` and optional `caption`, photos only); `GET|DELETE /api/sitters/current/bookings/:id/attachments/:attachmentId`.

Attachment limits are 10 MiB each. Receipt types: `application/pdf`, `image/jpeg`, `image/png`. Photo types: `image/jpeg`, `image/png`, `image/webp`. The server checks both declared type and file signature. Booking attachments and progress updates require a confirmed or completed stay; progress updates are accepted only while confirmed. Sensitive care and emergency fields are present only for confirmed/completed bookings. Attachment routes are private and require the booking to belong to the current sitter actor.

`GET /api/health` reports DB status and schema version.

Errors: 422 validation (`data.fieldErrors`), 404 not found, 409 conflict / invalid transition, 500 generic.

## Database

Default file `.data/nessie.sqlite` (gitignored). Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NESSIE_DB_PATH` | `.data/nessie.sqlite` | Database file |
| `NESSIE_BACKUP_DIR` | `.data/backups` | Backup directory |
| `NESSIE_BACKUP_KEEP_DAILY` / `_WEEKLY` | see `server/db/backup.ts` | Retention |
| `NESSIE_SEED_ON_EMPTY` | `true` in dev, `false` otherwise | Seed demo data into an empty DB |
| `NESSIE_PRIVATE_UPLOAD_DIR` | `.data/private-uploads` | Private receipt/photo file storage directory |

The SQLite backup commands do not include private upload files. Back up `NESSIE_PRIVATE_UPLOAD_DIR` separately using private, access-controlled storage and retention. The default local filesystem backend is not shared across application replicas and is not a managed/cloud file store; production deployments must provide a persistent private volume, protect it at rest, and include it in restore procedures.

Seed data (relative to today): Thomas Rogers' blocked dates (annual leave, a personal day, a weekend away) and bookings in several states (confirmed, awaiting times, requested, completed, cancelled, declined). Every other date is available.

### Migrations

SQL files in `server/db/migrations/` named `NNNN_description.sql`, forward-only, applied in order inside a transaction and recorded with a checksum.

```bash
npm run db:status    # applied / pending
npm run db:migrate   # apply pending (also runs automatically at server start)
```

Rules: never edit an applied migration (checksum mismatch is an error) — add a new file. If existing data and pending migrations are both present, a `pre-migration` backup is taken automatically first. During local development only, if you edited an unreleased migration, delete `.data/` and re-run.

### Backups

```bash
npm run db:backup                    # consistent snapshot (VACUUM INTO) + integrity check + sha256 manifest
npm run db:list-backups
npm run db:verify-backup -- <file>   # checksum + integrity check
```

Scheduled backups follow the daily/weekly retention policy; labelled safety backups (pre-migration, pre-restore) are retained separately (newest 10). Backups are safe to take while the server runs.

Recommended schedule (cron, daily at 02:00):

```cron
0 2 * * * cd /path/to/src && npm run db:backup >> .data/backup.log 2>&1
```

Also copy `.data/backups/` off the machine (object storage, another host). Backups contain personal data (names, phone numbers, addresses): encrypt them at rest and restrict access.

### Restores

1. **Stop the server** (a best-effort lock check refuses if the DB is in use; `--force` skips it).
2. `npm run db:list-backups`, then `npm run db:verify-backup -- <file>`.
3. `npm run db:restore -- <backup-file>` — verifies the backup, takes a `pre-restore` safety backup of the current DB, atomically swaps the file and removes stale `-wal`/`-shm` files.
4. Start the server; pending migrations (if the backup is older) are applied automatically.

Run a restore drill periodically against a scratch path: `NESSIE_DB_PATH=/tmp/drill.sqlite npm run db:restore -- <file>` then `npm run db:status`.

### Other commands

`npm run db:seed` seeds an empty DB (`-- --reset` replaces existing data; back up first).

`npm run db:seed:clean` resets the DB to a manual-testing baseline: Thomas Rogers with only a name (no bio, pets, services, rate or blocked dates) and a demo booker with no bookings. Back up first.
