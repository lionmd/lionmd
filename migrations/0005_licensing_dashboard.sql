-- Migration 0005: Licensing Dashboard
-- Adds collab_physician, collab_expiry to provider_licenses
-- license_editor role is handled in-app (no schema change needed beyond what's below)

ALTER TABLE provider_licenses ADD COLUMN collab_physician TEXT DEFAULT '';
ALTER TABLE provider_licenses ADD COLUMN collab_expiry    TEXT DEFAULT '';
