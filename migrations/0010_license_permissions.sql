-- Migration: 0010_license_permissions.sql
-- Adds permitted_actions and practice_type to provider_licenses
-- permitted_actions: e.g. "Can See Patients + Prescribe", "Can See Patients (No CRx)", "Pending", etc.
-- practice_type:     e.g. "independent", "collab_md", "md_self"
-- Applied: 2026-06-17

ALTER TABLE provider_licenses ADD COLUMN permitted_actions TEXT NOT NULL DEFAULT '';
ALTER TABLE provider_licenses ADD COLUMN practice_type     TEXT NOT NULL DEFAULT '';
