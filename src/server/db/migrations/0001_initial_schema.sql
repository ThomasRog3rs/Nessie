-- Nesse initial schema. Dates are yyyy-mm-dd TEXT, times HH:mm TEXT, instants ISO-8601 UTC TEXT,
-- money is integer pence. Bookings occupy the nights [start_date, end_date).

CREATE TABLE bookers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE sitters (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  bio        TEXT NOT NULL,
  rate_pence INTEGER NOT NULL CHECK (rate_pence >= 0),
  rate_basis TEXT NOT NULL CHECK (rate_basis IN ('per_night', 'per_day')),
  currency   TEXT NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
  timezone   TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

-- Preferred relationships: which sitters a booker may book.
CREATE TABLE booker_sitter_links (
  booker_id  TEXT NOT NULL REFERENCES bookers (id) ON DELETE CASCADE,
  sitter_id  TEXT NOT NULL REFERENCES sitters (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (booker_id, sitter_id)
) STRICT;

CREATE TABLE sitter_accepted_pets (
  sitter_id TEXT NOT NULL REFERENCES sitters (id) ON DELETE CASCADE,
  species   TEXT NOT NULL,
  position  INTEGER NOT NULL,
  PRIMARY KEY (sitter_id, species)
) STRICT;

CREATE TABLE sitter_services (
  id          TEXT PRIMARY KEY,
  sitter_id   TEXT NOT NULL REFERENCES sitters (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_pence INTEGER NOT NULL CHECK (price_pence >= 0),
  position    INTEGER NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;
CREATE INDEX idx_sitter_services_sitter ON sitter_services (sitter_id);

-- Dates the sitter is not working (inclusive range).
CREATE TABLE availability_blocks (
  id         TEXT PRIMARY KEY,
  sitter_id  TEXT NOT NULL REFERENCES sitters (id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date   TEXT NOT NULL,
  reason     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  CHECK (end_date >= start_date)
) STRICT;
CREATE INDEX idx_availability_blocks_range ON availability_blocks (sitter_id, start_date, end_date);

CREATE TABLE bookings (
  id                              TEXT PRIMARY KEY,
  booker_id                       TEXT NOT NULL REFERENCES bookers (id),
  sitter_id                       TEXT NOT NULL REFERENCES sitters (id),
  status                          TEXT NOT NULL CHECK (status IN
    ('requested', 'declined', 'accepted_times_pending', 'confirmed', 'cancelled', 'completed')),
  start_date                      TEXT NOT NULL,
  end_date                        TEXT NOT NULL,
  requested_arrival_time          TEXT NOT NULL,
  requested_departure_time        TEXT NOT NULL,
  agreed_arrival_time             TEXT,
  agreed_departure_time           TEXT,
  timezone                        TEXT NOT NULL,
  sitter_name_snapshot            TEXT NOT NULL,
  rate_pence                      INTEGER NOT NULL CHECK (rate_pence >= 0),
  rate_basis                      TEXT NOT NULL CHECK (rate_basis IN ('per_night', 'per_day')),
  care_notes                      TEXT NOT NULL DEFAULT '',
  property_instructions           TEXT NOT NULL DEFAULT '',
  travel_amount_pence             INTEGER NOT NULL DEFAULT 0 CHECK (travel_amount_pence >= 0),
  travel_notes                    TEXT NOT NULL DEFAULT '',
  emergency_contact_name          TEXT NOT NULL,
  emergency_contact_phone         TEXT NOT NULL,
  emergency_contact_relationship  TEXT NOT NULL DEFAULT '',
  vet_name                        TEXT NOT NULL DEFAULT '',
  vet_phone                       TEXT NOT NULL DEFAULT '',
  emergency_instructions          TEXT NOT NULL DEFAULT '',
  cancellation_term_acknowledged  INTEGER NOT NULL CHECK (cancellation_term_acknowledged IN (0, 1)),
  created_at                      TEXT NOT NULL,
  updated_at                      TEXT NOT NULL,
  CHECK (end_date > start_date),
  CHECK ((agreed_arrival_time IS NULL) = (agreed_departure_time IS NULL))
) STRICT;
CREATE INDEX idx_bookings_sitter_range ON bookings (sitter_id, status, start_date, end_date);
CREATE INDEX idx_bookings_booker_created ON bookings (booker_id, created_at);

CREATE TABLE booking_pets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  species    TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_booking_pets_booking ON booking_pets (booking_id);

-- Price is frozen at request time so later rate changes never alter agreed costs.
CREATE TABLE booking_services (
  booking_id    TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  service_id    TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price_pence   INTEGER NOT NULL CHECK (price_pence >= 0),
  position      INTEGER NOT NULL,
  PRIMARY KEY (booking_id, service_id)
) STRICT;

CREATE TABLE booking_incidental_expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id   TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  amount_pence INTEGER NOT NULL CHECK (amount_pence >= 0),
  position     INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_booking_expenses_booking ON booking_incidental_expenses (booking_id);

-- Append-only audit trail.
CREATE TABLE booking_history (
  id         TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  at         TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN
    ('requested', 'accepted', 'declined', 'times_proposed', 'times_agreed', 'changed', 'cancelled', 'completed')),
  actor      TEXT NOT NULL CHECK (actor IN ('booker', 'sitter')),
  message    TEXT NOT NULL
) STRICT;
CREATE INDEX idx_booking_history_booking ON booking_history (booking_id, at);
