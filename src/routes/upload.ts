import { Hono } from 'hono'
import { requireAuth } from './auth'

const upload = new Hono<{ Bindings: { DB: D1Database } }>()

// ── Rate lookup helpers ───────────────────────────────────────────────────────

async function getRates(db: D1Database) {
  const rows = await db.prepare('SELECT * FROM payment_rates').all<any>()
  const map: Record<string, { carevalidate_rate: number; contractor_rate: number }> = {}
  for (const r of rows.results) map[r.visit_type] = r
  return map
}

async function getTypeRates(db: D1Database) {
  const rows = await db.prepare('SELECT * FROM contractor_type_rates').all<any>()
  const map: Record<string, Record<string, number>> = {}
  for (const r of rows.results) {
    if (!map[r.contractor_type]) map[r.contractor_type] = {}
    map[r.contractor_type][r.visit_type] = r.contractor_rate
  }
  return map
}

async function getContractorType(db: D1Database, contractorId: number | null): Promise<string> {
  if (!contractorId) return 'regular'
  const c = await db.prepare('SELECT contractor_type FROM contractors WHERE id = ?').bind(contractorId).first<any>()
  return c?.contractor_type || 'regular'
}

function detectVisitType(row: any): string {
  const vt = (row.visit_type || row.VisitType || '').toString().toUpperCase().trim()
  if (vt.includes('ASYNC') || vt.includes('TEXT') || vt.includes('EMAIL')) return 'ASYNC_TEXT_EMAIL'
  if (vt.includes('PHONE')) return 'SYNC_PHONE'
  if (vt.includes('VIDEO')) return 'SYNC_VIDEO'
  if (vt.includes('IN_PERSON') || vt.includes('PERSON')) return 'SYNC_IN_PERSON'
  if (vt.includes('NO_SHOW') || vt.includes('NOSHOW')) return 'NO_SHOW'
  if (vt.includes('ORDERLY')) return 'ORDERLY'
  return vt || 'ASYNC_TEXT_EMAIL'
}

function buildPeriodKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

async function processRows(
  db: D1Database,
  sessionId: number,
  rows: any[],
  rates: Record<string, any>,
  typeRates: Record<string, Record<string, number>>,
  contractorCache: Map<string, { id: number; type: string }>
) {
  const stmts = []
  let totalCV = 0
  let totalContractor = 0

  for (const row of rows) {
    const visitType = detectVisitType(row)
    const decisionStatus = (row.decision_status || row.DecisionStatus || row.Status || '').toString().trim()
    const caseId = row.case_id || row.CaseId || row.case_id_short || ''
    const caseIdShort = caseId.length > 8 ? caseId.substring(0, 8) : caseId
    const orgName = row.organization_name || row.OrganizationName || row.Organization || ''
    const patientName = row.patient_name || row.PatientName || row.Patient || ''
    const doctorName = row.doctor_name || row.DoctorName || row.Doctor || row.ProviderName || ''
    const decisionDate = row.decision_date || row.DecisionDate || ''
    const isOrderly = visitType === 'ORDERLY' ? 1 : 0

    // Match contractor by doctor name
    let contractorId: number | null = null
    let contractorType = 'regular'
    if (doctorName) {
      const key = doctorName.toLowerCase().trim()
      if (contractorCache.has(key)) {
        const cached = contractorCache.get(key)!
        contractorId = cached.id
        contractorType = cached.type
      } else {
        const contractor = await db.prepare(
          `SELECT id, contractor_type FROM contractors WHERE is_active = 1 AND (
            LOWER(name) = LOWER(?) OR
            LOWER(TRIM(first_name || ' ' || last_name)) = LOWER(?)
          ) LIMIT 1`
        ).bind(key, key).first<any>()
        if (contractor) {
          contractorId = contractor.id
          contractorType = contractor.contractor_type || 'regular'
          contractorCache.set(key, { id: contractor.id, type: contractorType })
        }
      }
    }

    // Compute fees
    const rateRow = rates[visitType] || { carevalidate_rate: 0, contractor_rate: 0 }
    let cvFee = 0
    let contractorFee = 0

    // CareValidate fee: denied cases get $0 by default (period setting controls override)
    if (decisionStatus.toUpperCase() !== 'DENIED') {
      cvFee = rateRow.carevalidate_rate || 0
    }

    // Contractor fee: use type-specific rate if available
    const typeRateForType = typeRates[contractorType] || {}
    contractorFee = typeRateForType[visitType] ?? rateRow.contractor_rate ?? 0

    totalCV += cvFee
    totalContractor += contractorFee

    stmts.push(
      db.prepare(
        `INSERT INTO consults (session_id, case_id, case_id_short, organization_name, patient_name, doctor_name,
          decision_date, decision_status, visit_type, carevalidate_fee, contractor_fee, contractor_id, is_orderly)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(sessionId, caseId, caseIdShort, orgName, patientName, doctorName,
             decisionDate, decisionStatus, visitType, cvFee, contractorFee, contractorId, isOrderly)
    )
  }

  // Batch insert (D1 max 1000 statements per batch)
  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100))
  }

  return { totalCV, totalContractor, count: rows.length }
}

// ── POST /api/upload ───────────────────────────────────────────────────────────
upload.post('/', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { filename, source_label, period_label, period_month, period_year, rows, is_last_chunk } = body

  if (!period_label || !period_month || !period_year || !rows?.length) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const period_key = buildPeriodKey(parseInt(period_month), parseInt(period_year))

  // Create session
  const sessionResult = await c.env.DB.prepare(
    `INSERT INTO upload_sessions (filename, period_label, period_month, period_year, period_key, source_label, status)
     VALUES (?, ?, ?, ?, ?, ?, 'processing') RETURNING id`
  ).bind(filename || source_label, period_label, period_month, period_year, period_key, source_label || filename).first<any>()

  const sessionId = sessionResult.id

  const rates = await getRates(c.env.DB)
  const typeRates = await getTypeRates(c.env.DB)
  const contractorCache = new Map<string, { id: number; type: string }>()

  const { totalCV, totalContractor, count } = await processRows(
    c.env.DB, sessionId, rows, rates, typeRates, contractorCache
  )

  if (is_last_chunk) {
    await c.env.DB.prepare(
      `UPDATE upload_sessions SET total_cases = ?, total_carevalidate_amount = ?, total_contractor_amount = ?, status = 'active' WHERE id = ?`
    ).bind(count, totalCV, totalContractor, sessionId).run()
  }

  return c.json({ session_id: sessionId, period_key, total_cases: count, total_cv: totalCV, total_contractor: totalContractor })
})

// ── POST /api/upload/chunk ─────────────────────────────────────────────────────
upload.post('/chunk', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { session_id, rows, is_last_chunk } = await c.req.json()
  if (!session_id || !rows?.length) return c.json({ error: 'Missing fields' }, 400)

  const session = await c.env.DB.prepare('SELECT * FROM upload_sessions WHERE id = ?').bind(session_id).first<any>()
  if (!session) return c.json({ error: 'Session not found' }, 404)

  const rates = await getRates(c.env.DB)
  const typeRates = await getTypeRates(c.env.DB)
  const contractorCache = new Map<string, { id: number; type: string }>()

  const { totalCV, totalContractor, count } = await processRows(
    c.env.DB, session_id, rows, rates, typeRates, contractorCache
  )

  if (is_last_chunk) {
    // Get totals so far and add this chunk
    const totals = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt, SUM(carevalidate_fee) as cv, SUM(contractor_fee) as ct FROM consults WHERE session_id = ?`
    ).bind(session_id).first<any>()

    await c.env.DB.prepare(
      `UPDATE upload_sessions SET total_cases = ?, total_carevalidate_amount = ?, total_contractor_amount = ?, status = 'active' WHERE id = ?`
    ).bind(totals.cnt, totals.cv || 0, totals.ct || 0, session_id).run()
  }

  return c.json({ session_id, added: count, is_last_chunk })
})

// ── POST /api/recalculate ─────────────────────────────────────────────────────
upload.post('/recalculate', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json().catch(() => ({}))
  const period_key = body.period_key

  const rates = await getRates(c.env.DB)
  const typeRates = await getTypeRates(c.env.DB)

  // Get all contractors for type lookup
  const allContractors = await c.env.DB.prepare('SELECT id, contractor_type FROM contractors').all<any>()
  const contractorTypeMap: Record<number, string> = {}
  for (const ct of allContractors.results) contractorTypeMap[ct.id] = ct.contractor_type || 'regular'

  // Get period settings for denied_paid logic
  let deniedPaid = 0
  if (period_key) {
    const ps = await c.env.DB.prepare('SELECT denied_paid FROM period_settings WHERE period_key = ?').bind(period_key).first<any>()
    deniedPaid = ps?.denied_paid ?? 0
  }

  // Get all non-overridden consults for the period
  let consultsQuery = `SELECT c.id, c.visit_type, c.decision_status, c.contractor_id, c.is_override
    FROM consults c
    JOIN upload_sessions s ON c.session_id = s.id
    WHERE c.is_override = 0`
  if (period_key) consultsQuery += ` AND s.period_key = '${period_key}'`

  const consults = await c.env.DB.prepare(consultsQuery).all<any>()
  const stmts = []

  for (const consult of consults.results) {
    const visitType = consult.visit_type || 'ASYNC_TEXT_EMAIL'
    const rateRow = rates[visitType] || { carevalidate_rate: 0, contractor_rate: 0 }
    const contractorType = consult.contractor_id ? (contractorTypeMap[consult.contractor_id] || 'regular') : 'regular'
    const typeRateForType = typeRates[contractorType] || {}

    const isDenied = (consult.decision_status || '').toUpperCase() === 'DENIED'
    const cvFee = (isDenied && !deniedPaid) ? 0 : (rateRow.carevalidate_rate || 0)
    const contractorFee = typeRateForType[visitType] ?? rateRow.contractor_rate ?? 0

    stmts.push(
      c.env.DB.prepare('UPDATE consults SET carevalidate_fee = ?, contractor_fee = ? WHERE id = ?')
        .bind(cvFee, contractorFee, consult.id)
    )
  }

  for (let i = 0; i < stmts.length; i += 100) {
    await c.env.DB.batch(stmts.slice(i, i + 100))
  }

  // Update session totals
  let sessionsQuery = 'SELECT DISTINCT s.id FROM upload_sessions s JOIN consults c ON c.session_id = s.id WHERE 1=1'
  if (period_key) sessionsQuery += ` AND s.period_key = '${period_key}'`
  const affectedSessions = await c.env.DB.prepare(sessionsQuery).all<any>()

  for (const sess of affectedSessions.results) {
    const totals = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt, SUM(carevalidate_fee) as cv, SUM(contractor_fee) as ct FROM consults WHERE session_id = ?'
    ).bind(sess.id).first<any>()
    await c.env.DB.prepare(
      'UPDATE upload_sessions SET total_cases = ?, total_carevalidate_amount = ?, total_contractor_amount = ? WHERE id = ?'
    ).bind(totals.cnt, totals.cv || 0, totals.ct || 0, sess.id).run()
  }

  return c.json({ success: true, updated: stmts.length })
})

export default upload
