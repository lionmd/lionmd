-- Migration 0012: Allow multiple payment entries per client per month
-- The old UNIQUE(client_id, period_key) constraint is baked into the table DDL
-- and cannot be dropped in SQLite. Strategy: rename old table, create new one,
-- copy data over, then drop old table.

-- Step 1: rename existing table
ALTER TABLE cp_payment_entries RENAME TO cp_payment_entries_old;

-- Step 2: create new table WITHOUT the unique constraint, WITH payment_date column
CREATE TABLE cp_payment_entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id    INTEGER NOT NULL,
  period_key   TEXT    NOT NULL,              -- 'YYYY-MM'
  payment_date TEXT    DEFAULT NULL,          -- 'YYYY-MM-DD' optional explicit date
  amount       REAL,                          -- NULL = no payment recorded
  status       TEXT    DEFAULT 'paid',        -- 'paid'|'cancelled'|'past_due'|'venmo'|'pending'|'no_payment'
  notes        TEXT,                          -- dates, breakdown, extra info
  is_active    INTEGER DEFAULT 1,             -- 0 = client inactive for this period
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES cp_clients(id)
);

-- Step 3: copy all existing data
INSERT INTO cp_payment_entries (id, client_id, period_key, amount, status, notes, is_active, created_at, updated_at)
SELECT id, client_id, period_key, amount, status, notes, COALESCE(is_active, 1), created_at, updated_at
FROM cp_payment_entries_old;

-- Step 4: drop old table
DROP TABLE cp_payment_entries_old;

-- Step 5: index for fast per-client and per-period queries
CREATE INDEX IF NOT EXISTS idx_cp_entries_client    ON cp_payment_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_cp_entries_period    ON cp_payment_entries(period_key);
CREATE INDEX IF NOT EXISTS idx_cp_entries_client_period ON cp_payment_entries(client_id, period_key);
