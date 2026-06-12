-- Migration 0004: Manager role support
-- Adds managed_contractor_ids and managed_all to portal_users

ALTER TABLE portal_users ADD COLUMN managed_contractor_ids TEXT DEFAULT '';
-- Comma-separated contractor IDs the manager is allowed to see, e.g. "3,7,14"
-- Empty string means no contractors assigned yet

ALTER TABLE portal_users ADD COLUMN managed_all INTEGER DEFAULT 0;
-- 1 = manager can see ALL contractors (override for general managers)
-- 0 = scoped to managed_contractor_ids only
