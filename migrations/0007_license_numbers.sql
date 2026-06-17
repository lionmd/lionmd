-- Migration 0007: License numbers from 33 contractor PDFs
-- Extracted from page 7 of independent contractor agreements
-- Combines: UPDATE existing rows + INSERT missing state rows + UPDATE
--
-- NOTE: 'INSERT OR IGNORE' ensures idempotency if migration re-runs
-- Providers with no D1 rows (cid=3,48,58) have their rows created here

-- ── contractor_id=3 ──────────────────────────────────
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (3, 'CO', 'NP', 'active', 'APN.1000401-NP', '', '');
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (3, 'LA', 'NP', 'active', 'LP-0010719', '', '');
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (3, 'MI', 'NP', 'active', 'RN336182', '', '');
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (3, 'NJ', 'NP', 'active', '71012866A', '', '');
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (3, 'TN', 'NP', 'active', 'APRN11021654', '', '');
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (3, 'TX', 'NP', 'active', '95036321', '', '');
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (3, 'WI', 'NP', 'active', '209031794', '', '');

-- ── contractor_id=4 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C-APN.0004542-C-NP' WHERE contractor_id=4 AND state='CO';
UPDATE provider_licenses SET license_number='GAA-NP001211' WHERE contractor_id=4 AND state='GA';
UPDATE provider_licenses SET license_number='3-001434' WHERE contractor_id=4 AND state='IA';
UPDATE provider_licenses SET license_number='12.012640' WHERE contractor_id=4 AND state='KS';
UPDATE provider_licenses SET license_number='LG-0013146' WHERE contractor_id=4 AND state='LA';
UPDATE provider_licenses SET license_number='APRN-5547' WHERE contractor_id=4 AND state='MS';
UPDATE provider_licenses SET license_number='71015571A' WHERE contractor_id=4 AND state='NJ';
UPDATE provider_licenses SET license_number='APRN11020951' WHERE contractor_id=4 AND state='TN';
UPDATE provider_licenses SET license_number='95031210' WHERE contractor_id=4 AND state='TX';
UPDATE provider_licenses SET license_number='209028469' WHERE contractor_id=4 AND state='WI';

-- ── contractor_id=5 ──────────────────────────────────
UPDATE provider_licenses SET license_number='APN.0995932-NP' WHERE contractor_id=5 AND state='CO';
UPDATE provider_licenses SET license_number='CNP231158' WHERE contractor_id=5 AND state='CT';
UPDATE provider_licenses SET license_number='4704399999' WHERE contractor_id=5 AND state='NV';
UPDATE provider_licenses SET license_number='53-84302-121' WHERE contractor_id=5 AND state='WI';

-- ── contractor_id=8 ──────────────────────────────────
UPDATE provider_licenses SET license_number='APN.0997345-NP' WHERE contractor_id=8 AND state='CO';
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (8, 'LA', 'NP', 'active', 'LG-0011938', '', '');
UPDATE provider_licenses SET license_number='RN281872' WHERE contractor_id=8 AND state='MI';
UPDATE provider_licenses SET license_number='APRN-4494' WHERE contractor_id=8 AND state='MS';
UPDATE provider_licenses SET license_number='APRN11019101' WHERE contractor_id=8 AND state='TN';
UPDATE provider_licenses SET license_number='95026625' WHERE contractor_id=8 AND state='TX';
UPDATE provider_licenses SET license_number='209.024587' WHERE contractor_id=8 AND state='WI';

-- ── contractor_id=10 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C-APN.0100502-C-NP' WHERE contractor_id=10 AND state='CO';
UPDATE provider_licenses SET license_number='A174207' WHERE contractor_id=10 AND state='MO';
UPDATE provider_licenses SET license_number='NUR-APRN-LIC-235328' WHERE contractor_id=10 AND state='NH';

-- ── contractor_id=11 ──────────────────────────────────
UPDATE provider_licenses SET license_number='CDR.0005209' WHERE contractor_id=11 AND state='CO';
UPDATE provider_licenses SET license_number='A193998' WHERE contractor_id=11 AND state='MO';
UPDATE provider_licenses SET license_number='C1-0028476' WHERE contractor_id=11 AND state='OH';

-- ── contractor_id=13 ──────────────────────────────────
UPDATE provider_licenses SET license_number='APN.1000290-NP' WHERE contractor_id=13 AND state='CO';
UPDATE provider_licenses SET license_number='CNP221458' WHERE contractor_id=13 AND state='CT';
UPDATE provider_licenses SET license_number='95035627' WHERE contractor_id=13 AND state='TX';

-- ── contractor_id=15 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C-APN.0102556-C-NP' WHERE contractor_id=15 AND state='CO';
UPDATE provider_licenses SET license_number='GAA-NP003050' WHERE contractor_id=15 AND state='GA';
UPDATE provider_licenses SET license_number='3-002423' WHERE contractor_id=15 AND state='IA';
UPDATE provider_licenses SET license_number='LG-0013290' WHERE contractor_id=15 AND state='LA';
UPDATE provider_licenses SET license_number='A005313' WHERE contractor_id=15 AND state='MO';
UPDATE provider_licenses SET license_number='APRN-4937' WHERE contractor_id=15 AND state='MS';
UPDATE provider_licenses SET license_number='71016682A' WHERE contractor_id=15 AND state='NJ';
UPDATE provider_licenses SET license_number='APRN11033623' WHERE contractor_id=15 AND state='TN';
UPDATE provider_licenses SET license_number='95035143' WHERE contractor_id=15 AND state='TX';

-- ── contractor_id=16 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C-APN.0101058-C-NP' WHERE contractor_id=16 AND state='CO';
UPDATE provider_licenses SET license_number='GAA-NP003343' WHERE contractor_id=16 AND state='GA';
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (16, 'LA', 'NP', 'active', 'LG-0012919', '', '');
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (16, 'MS', 'NP', 'active', 'APRN-4973', '', '');
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (16, 'NJ', 'NP', 'active', '71016360A', '', '');
UPDATE provider_licenses SET license_number='APRN11020773' WHERE contractor_id=16 AND state='TN';
UPDATE provider_licenses SET license_number='95030124' WHERE contractor_id=16 AND state='TX';
UPDATE provider_licenses SET license_number='209033632' WHERE contractor_id=16 AND state='WI';

-- ── contractor_id=17 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C-APN.0003444-C-NP' WHERE contractor_id=17 AND state='CO';
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (17, 'LA', 'NP', 'active', 'LP-0010499', '', '');
UPDATE provider_licenses SET license_number='71011708A' WHERE contractor_id=17 AND state='NJ';
UPDATE provider_licenses SET license_number='APRN11014254' WHERE contractor_id=17 AND state='TN';
UPDATE provider_licenses SET license_number='95020708' WHERE contractor_id=17 AND state='TX';

-- ── contractor_id=18 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C-APN.0004425-C-NP' WHERE contractor_id=18 AND state='CO';
UPDATE provider_licenses SET license_number='GAA-NP001099' WHERE contractor_id=18 AND state='GA';
UPDATE provider_licenses SET license_number='1-188253' WHERE contractor_id=18 AND state='IA';
UPDATE provider_licenses SET license_number='LG-0012175' WHERE contractor_id=18 AND state='LA';
UPDATE provider_licenses SET license_number='71015622A' WHERE contractor_id=18 AND state='NJ';
UPDATE provider_licenses SET license_number='APRN11018282' WHERE contractor_id=18 AND state='TN';
UPDATE provider_licenses SET license_number='95023170' WHERE contractor_id=18 AND state='TX';

-- ── contractor_id=20 ──────────────────────────────────
UPDATE provider_licenses SET license_number='CDR.0000042' WHERE contractor_id=20 AND state='CO';
UPDATE provider_licenses SET license_number='C2-0013416' WHERE contractor_id=20 AND state='OH';
UPDATE provider_licenses SET license_number='OS16054' WHERE contractor_id=20 AND state='OK';
UPDATE provider_licenses SET license_number='E-11590' WHERE contractor_id=20 AND state='VA';
UPDATE provider_licenses SET license_number='036.144558' WHERE contractor_id=20 AND state='WA';

-- ── contractor_id=22 ──────────────────────────────────
UPDATE provider_licenses SET license_number='CDR.0006334' WHERE contractor_id=22 AND state='CO';
UPDATE provider_licenses SET license_number='MD30162' WHERE contractor_id=22 AND state='MD';
UPDATE provider_licenses SET license_number='ME178499' WHERE contractor_id=22 AND state='ME';
UPDATE provider_licenses SET license_number='MD-26462' WHERE contractor_id=22 AND state='NJ';
UPDATE provider_licenses SET license_number='036.178374' WHERE contractor_id=22 AND state='WA';

-- ── contractor_id=23 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C-APN.0001246-C-NP' WHERE contractor_id=23 AND state='CO';
UPDATE provider_licenses SET license_number='3-000430' WHERE contractor_id=23 AND state='IA';
UPDATE provider_licenses SET license_number='APRN9494374' WHERE contractor_id=23 AND state='IN';
UPDATE provider_licenses SET license_number='LG-0001248' WHERE contractor_id=23 AND state='LA';
UPDATE provider_licenses SET license_number='RN280513' WHERE contractor_id=23 AND state='MI';
UPDATE provider_licenses SET license_number='A006027' WHERE contractor_id=23 AND state='MO';
UPDATE provider_licenses SET license_number='71017292A' WHERE contractor_id=23 AND state='NJ';
UPDATE provider_licenses SET license_number='95010366' WHERE contractor_id=23 AND state='TX';
UPDATE provider_licenses SET license_number='209019143' WHERE contractor_id=23 AND state='WI';

-- ── contractor_id=24 ──────────────────────────────────
UPDATE provider_licenses SET license_number='CNP251786' WHERE contractor_id=24 AND state='CT';
UPDATE provider_licenses SET license_number='26NJ00955300' WHERE contractor_id=24 AND state='NJ';
UPDATE provider_licenses SET license_number='2025051354' WHERE contractor_id=24 AND state='VA';

-- ── contractor_id=26 ──────────────────────────────────
UPDATE provider_licenses SET license_number='CDR.0004045' WHERE contractor_id=26 AND state='CO';
UPDATE provider_licenses SET license_number='04-49955' WHERE contractor_id=26 AND state='KS';
UPDATE provider_licenses SET license_number='ME159395' WHERE contractor_id=26 AND state='ME';
UPDATE provider_licenses SET license_number='A173726' WHERE contractor_id=26 AND state='MO';
UPDATE provider_licenses SET license_number='MD-54160' WHERE contractor_id=26 AND state='NJ';

-- ── contractor_id=27 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C-APN.0103427-C-NP' WHERE contractor_id=27 AND state='CO';
UPDATE provider_licenses SET license_number='3-001465' WHERE contractor_id=27 AND state='IA';
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (27, 'LA', 'NP', 'active', 'LP-0010956', '', '');
UPDATE provider_licenses SET license_number='95034782' WHERE contractor_id=27 AND state='TX';

-- ── contractor_id=28 ──────────────────────────────────
UPDATE provider_licenses SET license_number='APRN9258243' WHERE contractor_id=28 AND state='IN';
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (28, 'LA', 'NP', 'active', 'LG-0012997', '', '');
UPDATE provider_licenses SET license_number='71012166A' WHERE contractor_id=28 AND state='NJ';
UPDATE provider_licenses SET license_number='95024977' WHERE contractor_id=28 AND state='TX';
UPDATE provider_licenses SET license_number='209031520' WHERE contractor_id=28 AND state='WI';

-- ── contractor_id=47 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C-APN.0002937-C-NP' WHERE contractor_id=47 AND state='CO';
UPDATE provider_licenses SET license_number='LP-0010501' WHERE contractor_id=47 AND state='LA';
UPDATE provider_licenses SET license_number='71008937A' WHERE contractor_id=47 AND state='NJ';
UPDATE provider_licenses SET license_number='4704366028' WHERE contractor_id=47 AND state='NV';

-- ── contractor_id=48 ──────────────────────────────────
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (48, 'CO', 'PA', 'active', 'C0007524', '', '');
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (48, 'PA', 'PA', 'active', 'PA8964', '', '');

-- ── contractor_id=49 ──────────────────────────────────
UPDATE provider_licenses SET license_number='CDR.0002331' WHERE contractor_id=49 AND state='CO';
UPDATE provider_licenses SET license_number='04-49279' WHERE contractor_id=49 AND state='KS';
UPDATE provider_licenses SET license_number='036163024' WHERE contractor_id=49 AND state='WA';

-- ── contractor_id=51 ──────────────────────────────────
UPDATE provider_licenses SET license_number='CDR.0002527' WHERE contractor_id=51 AND state='CO';
UPDATE provider_licenses SET license_number='04-47400' WHERE contractor_id=51 AND state='KS';
UPDATE provider_licenses SET license_number='MD-25124-0' WHERE contractor_id=51 AND state='MD';
UPDATE provider_licenses SET license_number='MD-56387' WHERE contractor_id=51 AND state='NJ';
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (51, 'OH', 'MD', 'active', 'C1-0025903', '', '');
UPDATE provider_licenses SET license_number='TPME236' WHERE contractor_id=51 AND state='TN';
UPDATE provider_licenses SET license_number='036.163742' WHERE contractor_id=51 AND state='WA';

-- ── contractor_id=52 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C170543' WHERE contractor_id=52 AND state='CO';
UPDATE provider_licenses SET license_number='MC-0725' WHERE contractor_id=52 AND state='MD';
UPDATE provider_licenses SET license_number='ME146686' WHERE contractor_id=52 AND state='ME';
UPDATE provider_licenses SET license_number='MD-21472' WHERE contractor_id=52 AND state='NJ';
UPDATE provider_licenses SET license_number='C1-0024077' WHERE contractor_id=52 AND state='OH';
UPDATE provider_licenses SET license_number='DR.0065155' WHERE contractor_id=52 AND state='OR';
UPDATE provider_licenses SET license_number='E-13637' WHERE contractor_id=52 AND state='VA';
UPDATE provider_licenses SET license_number='036154651' WHERE contractor_id=52 AND state='WA';

-- ── contractor_id=54 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C-APN.0104025-C-NP' WHERE contractor_id=54 AND state='CO';
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (54, 'LA', 'NP', 'active', 'LP-0010937', '', '');
UPDATE provider_licenses SET license_number='APRN11042397' WHERE contractor_id=54 AND state='TN';

-- ── contractor_id=55 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C-APN.0002736-C-NP' WHERE contractor_id=55 AND state='CO';
UPDATE provider_licenses SET license_number='GAA-NP000224' WHERE contractor_id=55 AND state='GA';
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (55, 'LA', 'NP', 'active', 'LG-0013424', '', '');
UPDATE provider_licenses SET license_number='APRN-4992' WHERE contractor_id=55 AND state='MS';
UPDATE provider_licenses SET license_number='277003711' WHERE contractor_id=55 AND state='OR';
UPDATE provider_licenses SET license_number='APRN11011398' WHERE contractor_id=55 AND state='TN';
UPDATE provider_licenses SET license_number='95019509' WHERE contractor_id=55 AND state='TX';

-- ── contractor_id=58 ──────────────────────────────────
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (58, 'ME', 'MD', 'active', 'ME180600', '', '');

-- ── contractor_id=60 ──────────────────────────────────
UPDATE provider_licenses SET license_number='C5691' WHERE contractor_id=60 AND state='CT';
INSERT OR IGNORE INTO provider_licenses (contractor_id, state, license_type, status, license_number, collab_physician, collab_expiry) VALUES (60, 'DE', 'MD', 'active', 'DOS-2989', '', '');
UPDATE provider_licenses SET license_number='25IB13141600' WHERE contractor_id=60 AND state='IL';
UPDATE provider_licenses SET license_number='036180296' WHERE contractor_id=60 AND state='WA';

-- Total: 120 UPDATEs, 21 INSERTs