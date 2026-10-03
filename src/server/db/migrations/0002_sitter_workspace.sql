ALTER TABLE sitters ADD COLUMN location TEXT NOT NULL DEFAULT '';
ALTER TABLE sitters ADD COLUMN contact_phone TEXT NOT NULL DEFAULT '';

ALTER TABLE booking_history RENAME TO booking_history_v1;

CREATE TABLE booking_history (
  id         TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  at         TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN
    ('requested', 'accepted', 'declined', 'times_proposed', 'times_agreed', 'changed', 'cancelled', 'completed',
     'progress_update', 'expense_recorded', 'photo_added', 'receipt_added', 'attachment_removed')),
  actor      TEXT NOT NULL CHECK (actor IN ('booker', 'sitter')),
  message    TEXT NOT NULL
) STRICT;

INSERT INTO booking_history (id, booking_id, at, type, actor, message)
SELECT id, booking_id, at, type, actor, message FROM booking_history_v1;

DROP TABLE booking_history_v1;
CREATE INDEX idx_booking_history_booking ON booking_history (booking_id, at);

CREATE TABLE booking_progress_updates (
  id         TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  update_date TEXT NOT NULL,
  message    TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_booking_updates_booking ON booking_progress_updates (booking_id, created_at, id);

CREATE TABLE sitter_expenses (
  id           TEXT PRIMARY KEY,
  booking_id   TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('travel', 'incidental')),
  description  TEXT NOT NULL,
  amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
  creator_id   TEXT NOT NULL,
  created_at   TEXT NOT NULL
) STRICT;
CREATE INDEX idx_sitter_expenses_booking ON sitter_expenses (booking_id, created_at, id);

CREATE TABLE booking_attachments (
  id            TEXT PRIMARY KEY,
  booking_id    TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  expense_id    TEXT REFERENCES sitter_expenses (id) ON DELETE SET NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('receipt', 'photo')),
  storage_key   TEXT NOT NULL UNIQUE,
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  caption       TEXT NOT NULL DEFAULT '',
  creator_id    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  CHECK ((kind = 'receipt' AND expense_id IS NOT NULL) OR (kind = 'photo' AND expense_id IS NULL))
) STRICT;
CREATE UNIQUE INDEX idx_booking_receipt_expense ON booking_attachments (expense_id) WHERE kind = 'receipt';
CREATE INDEX idx_booking_attachments_booking ON booking_attachments (booking_id, created_at, id);
