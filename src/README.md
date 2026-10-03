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

## API

Booker: `GET /api/sitters/current`, `GET /api/sitters/current/availability?from=&to=`, `GET|POST /api/bookings`, `GET /api/bookings/:id`, `POST /api/bookings/:id/cancel`.

Sitter: `GET|POST /api/sitters/current/blocks`, `PATCH|DELETE /api/sitters/current/blocks/:id`, `GET /api/sitters/current/bookings`, `POST /api/sitters/current/bookings/:id/{accept,decline,times,cancel,complete}`.

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
