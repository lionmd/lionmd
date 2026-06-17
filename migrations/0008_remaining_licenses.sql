-- Migration 0008: Remaining license numbers
-- Ianina Metcalf (cid=19) — OCR from full PDF
-- Dina Whiteaker (cid=46) — PDF is CPA only (no license list page), pending
-- Amy Free / Gaines (cid=1) — PDF corrupt, pending manual entry
-- Rashelle Phelps (cid=14) — PDF corrupt, pending manual entry
-- Lea Thomas (cid=9) — PDF corrupt, pending manual entry

-- ─────────────────────────────────────────────────────────────────────────────
-- Ianina Metcalf (cid=19) — OCR confirmed from PDF pages 7-9
-- States confirmed in D1: AL,AR,AZ,CA,CO,CT,DE,FL,IA,IL,IN,KS,KY,MA,ME,MI,MO,MS,NC,NH,NJ,NM,NY,OH,OK,PA,RI,SC,TN,TX,UT,VA,VT,WA,WV,WY
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE provider_licenses SET license_number='3-002048'              WHERE contractor_id=19 AND state='AL';
UPDATE provider_licenses SET license_number='329125'                WHERE contractor_id=19 AND state='AZ';
UPDATE provider_licenses SET license_number='95034419'              WHERE contractor_id=19 AND state='CA';
UPDATE provider_licenses SET license_number='C-APN.0103567-C-NP'   WHERE contractor_id=19 AND state='CO';
UPDATE provider_licenses SET license_number='013930'                WHERE contractor_id=19 AND state='CT';
UPDATE provider_licenses SET license_number='LG-0013076'            WHERE contractor_id=19 AND state='DE';
UPDATE provider_licenses SET license_number='APRN11036747'          WHERE contractor_id=19 AND state='FL';
UPDATE provider_licenses SET license_number='53-83920-112'          WHERE contractor_id=19 AND state='KS';
UPDATE provider_licenses SET license_number='4043977'               WHERE contractor_id=19 AND state='KY';
UPDATE provider_licenses SET license_number='CNP231110'             WHERE contractor_id=19 AND state='ME';
UPDATE provider_licenses SET license_number='907145'                WHERE contractor_id=19 AND state='MS';
UPDATE provider_licenses SET license_number='2025032881'            WHERE contractor_id=19 AND state='MO';
UPDATE provider_licenses SET license_number='113493-23'             WHERE contractor_id=19 AND state='NH';
UPDATE provider_licenses SET license_number='26NJ00990600'          WHERE contractor_id=19 AND state='NJ';
UPDATE provider_licenses SET license_number='82307'                 WHERE contractor_id=19 AND state='NM';
UPDATE provider_licenses SET license_number='351047'                WHERE contractor_id=19 AND state='NY';
UPDATE provider_licenses SET license_number='APRN.CNP.0038344'      WHERE contractor_id=19 AND state='OH';
UPDATE provider_licenses SET license_number='SP031528'              WHERE contractor_id=19 AND state='PA';
UPDATE provider_licenses SET license_number='APRN04420'             WHERE contractor_id=19 AND state='RI';
UPDATE provider_licenses SET license_number='39481'                 WHERE contractor_id=19 AND state='TN';
UPDATE provider_licenses SET license_number='1159441'               WHERE contractor_id=19 AND state='TX';
UPDATE provider_licenses SET license_number='14207201-4405'         WHERE contractor_id=19 AND state='UT';
UPDATE provider_licenses SET license_number='101.0137589'           WHERE contractor_id=19 AND state='VT';
UPDATE provider_licenses SET license_number='0024193142'            WHERE contractor_id=19 AND state='VA';
UPDATE provider_licenses SET license_number='121485'                WHERE contractor_id=19 AND state='WV';
