# Deploying Nesse to Netlify

Netlify's filesystem is ephemeral, so production uses hosted SQLite (Turso/libSQL) for data, Netlify Blobs for private uploads and backups.

| Concern | Dev | Production |
| --- | --- | --- |
| Database | `file:.data/nessie.sqlite` | Turso (`libsql://…`) |
| Private uploads | `.data/private-uploads` | Netlify Blobs (`NESSIE_STORAGE=netlify-blobs`) |
| Backups | `.data/backups` | Netlify Blobs (`NESSIE_BACKUP_STORE=netlify-blobs`), nightly 03:00 UTC via `src/netlify/functions/backup.mts` |
| Seed | on empty DB in dev | never (`NESSIE_SEED_ON_EMPTY=false`) |

## Checklist

### 1. Turso (database)
- [ ] Create a database: `turso db create nesse-prod --location lhr` (pick a region near your Netlify functions).
- [ ] `turso db show nesse-prod --url` → `NESSIE_DATABASE_URL`.
- [ ] `turso db tokens create nesse-prod` → `NESSIE_DATABASE_AUTH_TOKEN`.
- [ ] Leave the DB empty: the first deploy creates the schema via `npm run db:migrate` (no seed).
- [ ] Note Turso's point-in-time restore window for your plan (`turso db create --from-db … --timestamp …`) as a second recovery path.

### 2. Clerk (production)
- [ ] In the Clerk dashboard, create the **Production** instance (clone settings from Development).
- [ ] Add your production domain and create the DNS records Clerk lists (frontend API, accounts, email/DKIM CNAMEs); wait until all show verified.
- [ ] Configure your own OAuth credentials for any social providers (Clerk's shared dev credentials don't work in production).
- [ ] Copy the `pk_live_…` and `sk_live_…` keys from API keys.
- [ ] Re-check sign-in methods, email verification and restrictions (consider "Restricted"/invite-only sign-up since Nesse is private).
- [ ] Development users do not carry over: the sitter signs up fresh in production (see step 6).

### 3. Netlify site
- [ ] Add the site from the Git repo; `netlify.toml` (repo root) sets base `src`, build `npm run db:migrate && npm run build`, Node 24 and the production storage/backup/seed flags.
- [ ] Set environment variables (scope: Builds **and** Functions/Runtime; mark secrets as secret):
  - `NESSIE_DATABASE_URL`, `NESSIE_DATABASE_AUTH_TOKEN`
  - `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_live_…`), `NUXT_CLERK_SECRET_KEY` (`sk_live_…`)
  - `NUXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NUXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
  - optional: `NESSIE_BACKUP_KEEP_DAILY` (14), `NESSIE_BACKUP_KEEP_WEEKLY` (8)
- [ ] Attach the custom domain and enable HTTPS; make sure it matches the domain configured in Clerk.

### 4. First deploy
- [ ] Trigger a deploy; confirm the log shows `Applied: 0001…, 0002…, 0003…`. A failed migration fails the deploy and leaves the previous version live.
- [ ] `curl https://<domain>/api/health` → `{"status":"ok","schemaVersion":3}`.
- [ ] Confirm no demo data exists.

### 5. Backups & recovery
- [ ] Netlify → Functions: confirm the scheduled `backup` function is listed; trigger it once manually and check it succeeds.
- [ ] Retrieve the backup list (locally, with production env vars exported): `npm run db:list-backups`, then `npm run db:verify-backup -- <file>`.
- [ ] Rehearse a restore into a **scratch** Turso DB (never first on prod): point `NESSIE_DATABASE_URL` at it and run `npm run db:restore -- <file>`. Use `--force` only to overwrite existing data; a safety backup is taken first.
- [ ] Every later migration automatically takes a `pre-migration` backup when the DB already holds data.
- [ ] Optional: periodically export a copy off-platform (`turso db shell nesse-prod .dump > backup.sql`); Blobs and Turso are both with third parties.

### 6. Go-live smoke test
- [ ] Sign up the sitter account on production immediately (the first sitter account claims the sitter record, so do this before sharing the URL).
- [ ] Complete the sitter profile, create a booker invite, join through it from another browser, create and accept a booking.
- [ ] Upload an attachment and receipt; confirm they download only when signed in as the right user.
- [ ] Confirm sign-out/in, and that `/sitter/*` is blocked for bookers.

### 7. Ongoing
- [ ] Schema changes: add `server/db/migrations/NNNN_name.sql`; never edit applied ones (checksums are verified). Deploys migrate automatically.
- [ ] Rotate Turso token / Clerk secret by updating Netlify env vars and redeploying.
- [ ] Monitor Netlify function logs for `[backup]` lines.

## Caveats
- The Netlify/Blobs/scheduled-function paths and Turso connectivity could not be exercised from the local environment; the build with the `netlify` preset, unit tests and local-file CLI flows pass. Validate on a Netlify deploy preview with a separate Turso DB first.
- Backups are logical dumps (JSON), suitable for this app's data size; very large uploads live in Blobs and are **not** included in the DB dump. Blobs have no versioning, so deleted attachments are not recoverable.
