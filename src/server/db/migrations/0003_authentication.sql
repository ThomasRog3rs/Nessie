-- Clerk authentication: accounts are linked to Clerk users, there is only ever one sitter,
-- and bookers join through single-use invite links issued by that sitter.

ALTER TABLE sitters ADD COLUMN clerk_user_id TEXT;
CREATE UNIQUE INDEX idx_sitters_clerk_user ON sitters (clerk_user_id) WHERE clerk_user_id IS NOT NULL;
-- Constant expression: every row collides, so the database itself guarantees a single sitter.
CREATE UNIQUE INDEX idx_single_sitter ON sitters ((1));

ALTER TABLE bookers ADD COLUMN clerk_user_id TEXT;
CREATE UNIQUE INDEX idx_bookers_clerk_user ON bookers (clerk_user_id) WHERE clerk_user_id IS NOT NULL;
ALTER TABLE bookers ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE bookers ADD COLUMN address_line TEXT NOT NULL DEFAULT '';
ALTER TABLE bookers ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE bookers ADD COLUMN postcode TEXT NOT NULL DEFAULT '';
ALTER TABLE bookers ADD COLUMN emergency_contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE bookers ADD COLUMN emergency_contact_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE bookers ADD COLUMN emergency_contact_relationship TEXT NOT NULL DEFAULT '';
ALTER TABLE bookers ADD COLUMN vet_name TEXT NOT NULL DEFAULT '';
ALTER TABLE bookers ADD COLUMN vet_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE bookers ADD COLUMN emergency_instructions TEXT NOT NULL DEFAULT '';
ALTER TABLE bookers ADD COLUMN property_instructions TEXT NOT NULL DEFAULT '';

CREATE TABLE booker_pets (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  booker_id TEXT NOT NULL REFERENCES bookers (id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  species   TEXT NOT NULL,
  notes     TEXT NOT NULL DEFAULT '',
  position  INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_booker_pets_booker ON booker_pets (booker_id);

-- Only a hash of the link token is stored; the link itself is shown once, when it is created.
CREATE TABLE booker_invites (
  id                TEXT PRIMARY KEY,
  sitter_id         TEXT NOT NULL REFERENCES sitters (id) ON DELETE CASCADE,
  token_hash        TEXT NOT NULL UNIQUE,
  label             TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  expires_at        TEXT NOT NULL,
  disabled_at       TEXT,
  used_at           TEXT,
  used_by_booker_id TEXT REFERENCES bookers (id) ON DELETE SET NULL
) STRICT;
CREATE INDEX idx_booker_invites_sitter ON booker_invites (sitter_id, created_at);
