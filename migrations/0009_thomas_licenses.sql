-- Migration: 0009_thomas_licenses.sql
-- Contractor: Lea Thomas (contractor_id = 9)
-- Source: OCR of Thomas_Lea_Lion Medical Independent Contractor Agreement.pdf (pages 7-10)
-- Applied: 2026-06-17
-- Notes:
--   - IN=71016428A is a DEA number — skipped per convention
--   - States with no number in PDF (blank rows): HI, KY, ME, MI, MN, MO, TN, WI, WV — no UPDATE needed
--   - Duplicate rows per state (double CV import artifact) — UPDATE hits both copies idempotently

UPDATE provider_licenses SET license_number = '307215'           WHERE contractor_id = 9 AND state = 'AZ';
UPDATE provider_licenses SET license_number = '95019976'         WHERE contractor_id = 9 AND state = 'CA';
UPDATE provider_licenses SET license_number = 'APN.1000153-NP'   WHERE contractor_id = 9 AND state = 'CO';
UPDATE provider_licenses SET license_number = 'APRN11030394'     WHERE contractor_id = 9 AND state = 'FL';
UPDATE provider_licenses SET license_number = '2761770'          WHERE contractor_id = 9 AND state = 'ID';
UPDATE provider_licenses SET license_number = 'H179944'          WHERE contractor_id = 9 AND state = 'IA';
UPDATE provider_licenses SET license_number = '53-83670-011'     WHERE contractor_id = 9 AND state = 'KS';
UPDATE provider_licenses SET license_number = 'NUR-APRN-LIC-239340' WHERE contractor_id = 9 AND state = 'MT';
UPDATE provider_licenses SET license_number = '115445'           WHERE contractor_id = 9 AND state = 'NE';
UPDATE provider_licenses SET license_number = '877423'           WHERE contractor_id = 9 AND state = 'NV';
UPDATE provider_licenses SET license_number = '26NJ15317900'     WHERE contractor_id = 9 AND state = 'NJ';
UPDATE provider_licenses SET license_number = '81280'            WHERE contractor_id = 9 AND state = 'NM';
UPDATE provider_licenses SET license_number = '311734'           WHERE contractor_id = 9 AND state = 'NY';
UPDATE provider_licenses SET license_number = '5022123'          WHERE contractor_id = 9 AND state = 'NC';
UPDATE provider_licenses SET license_number = '200675'           WHERE contractor_id = 9 AND state = 'ND';
UPDATE provider_licenses SET license_number = '10026918'         WHERE contractor_id = 9 AND state = 'OR';
UPDATE provider_licenses SET license_number = 'SP032516'         WHERE contractor_id = 9 AND state = 'PA';
UPDATE provider_licenses SET license_number = 'CP003383'         WHERE contractor_id = 9 AND state = 'SD';
UPDATE provider_licenses SET license_number = '1149781'          WHERE contractor_id = 9 AND state = 'TX';
UPDATE provider_licenses SET license_number = '13925744-4405'    WHERE contractor_id = 9 AND state = 'UT';
UPDATE provider_licenses SET license_number = '0024192892'       WHERE contractor_id = 9 AND state = 'VA';
UPDATE provider_licenses SET license_number = 'AP61552012'       WHERE contractor_id = 9 AND state = 'WA';
UPDATE provider_licenses SET license_number = '54434'            WHERE contractor_id = 9 AND state = 'WY';
