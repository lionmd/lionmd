-- Migration 0013: Provider Availability & Capacity Tracking
-- Two tables:
--   provider_availability  — recurring per-day-of-week schedule (weekly defaults)
--   provider_blocks        — specific date overrides (block-outs, limit changes)

-- ── Weekly schedule ────────────────────────────────────────────────────────
-- One row per provider per day_of_week (0=Sun … 6=Sat).
-- If a day has no row, the provider is considered available with no set limit.
CREATE TABLE IF NOT EXISTS provider_availability (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id   INTEGER NOT NULL,
  day_of_week     INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  max_consults    INTEGER NOT NULL DEFAULT 10,   -- 0 = unavailable that day
  location        TEXT    DEFAULT '',            -- e.g. "Clinic A", "Remote"
  notes           TEXT    DEFAULT '',
  is_active       INTEGER DEFAULT 1,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contractor_id) REFERENCES contractors(id),
  UNIQUE(contractor_id, day_of_week)
);

-- ── Specific date overrides ────────────────────────────────────────────────
-- One row per provider per date override.
CREATE TABLE IF NOT EXISTS provider_blocks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id   INTEGER NOT NULL,
  block_date      TEXT    NOT NULL,              -- 'YYYY-MM-DD'
  block_type      TEXT    NOT NULL DEFAULT 'unavailable', -- 'unavailable'|'limited'|'custom'
  max_consults    INTEGER DEFAULT 0,             -- 0 = fully blocked; >0 = partial limit
  reason          TEXT    DEFAULT '',            -- shown to admin
  notified_at     DATETIME DEFAULT NULL,         -- NULL = not yet notified
  created_by      TEXT    DEFAULT 'provider',    -- 'provider'|'admin'
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contractor_id) REFERENCES contractors(id)
);

CREATE INDEX IF NOT EXISTS idx_pav_contractor  ON provider_availability(contractor_id);
CREATE INDEX IF NOT EXISTS idx_pblk_contractor ON provider_blocks(contractor_id);
CREATE INDEX IF NOT EXISTS idx_pblk_date       ON provider_blocks(block_date);
