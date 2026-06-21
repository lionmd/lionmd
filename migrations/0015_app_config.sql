-- App-level configuration key-value store
-- Used for: shared view password, and other site-wide settings
CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed the shared view password with the current hardcoded value
INSERT OR IGNORE INTO app_config (key, value) VALUES ('shared_view_password', 'LionProviders2026!');
