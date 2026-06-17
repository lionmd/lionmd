-- Migration: 0011_deduplicate_licenses.sql
-- Purpose: Remove duplicate provider_licenses rows caused by double-import from CV HTML.
--          Each (contractor_id, state) pair may have 2-4 near-identical rows.
--          Strategy: score each row by count of non-empty meaningful fields;
--          keep the highest-scoring row (tiebreak: lowest id), delete the rest.
-- Note: Data across duplicate rows is nearly identical (same import); winner row
--       already has the best available data, so no merge step is needed.
-- Applied: 2026-06-17

-- DELETE all loser rows — every row whose id is NOT the winner for its group.
-- Winner = lowest id among those with the highest score in that (contractor_id, state) group.
DELETE FROM provider_licenses
WHERE id NOT IN (
  SELECT MIN(CASE WHEN row_score = max_score THEN id END)
  FROM (
    SELECT id, contractor_id, state,
      (CASE WHEN license_number   !='' THEN 1 ELSE 0 END) +
      (CASE WHEN expiry_date      !='' THEN 1 ELSE 0 END) +
      (CASE WHEN collab_physician !='' THEN 1 ELSE 0 END) +
      (CASE WHEN permitted_actions!='' THEN 1 ELSE 0 END) +
      (CASE WHEN practice_type   !='' THEN 1 ELSE 0 END) +
      (CASE WHEN status          !='' THEN 1 ELSE 0 END) AS row_score,
      MAX(
        (CASE WHEN license_number   !='' THEN 1 ELSE 0 END) +
        (CASE WHEN expiry_date      !='' THEN 1 ELSE 0 END) +
        (CASE WHEN collab_physician !='' THEN 1 ELSE 0 END) +
        (CASE WHEN permitted_actions!='' THEN 1 ELSE 0 END) +
        (CASE WHEN practice_type   !='' THEN 1 ELSE 0 END) +
        (CASE WHEN status          !='' THEN 1 ELSE 0 END)
      ) OVER (PARTITION BY contractor_id, state) AS max_score
    FROM provider_licenses
  ) t
  GROUP BY contractor_id, state
);
