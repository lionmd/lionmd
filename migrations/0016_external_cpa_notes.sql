-- Add external_cpa_notes to contractors table.
-- Physicians fill this in to declare any external CPA agreements (outside LionMDs)
-- so admins can track total capacity against state limits.
ALTER TABLE contractors ADD COLUMN external_cpa_notes TEXT NOT NULL DEFAULT '';
