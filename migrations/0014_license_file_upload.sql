-- Migration 0014: Add file upload columns to provider_licenses
-- Allows storing a copy of each state license document directly in the DB

ALTER TABLE provider_licenses ADD COLUMN license_file_name TEXT DEFAULT '';
ALTER TABLE provider_licenses ADD COLUMN license_file_data TEXT DEFAULT '';
ALTER TABLE provider_licenses ADD COLUMN license_file_mime TEXT DEFAULT '';
