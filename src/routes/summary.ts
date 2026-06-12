import { Hono } from 'hono'
import { requireAuth } from './auth'

const summary = new Hono<{ Bindings: { DB: D1Database } }>()

// ── GET /api/summary/period/:periodKey ────────────────────────────────────────
summary.get('/period/:periodKey', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const pk = c.req.param('periodKey')

  // Get period settings
  const periodSettings = await c.env.DB.prepare(
    'SELECT denied_paid FROM period_settings WHERE period_key = ?'
  ).bind(pk).first<any>()
  const deniedPaid = periodSettings?.denied_paid ?? 0

  // Per-contractor summary
  const rows = await c.env.DB.prepare(
    `SELECT
       c.contractor_id,
       ct.name as contractor_name,
       ct.contractor_type,
       ct.earns_commission,
       ct.gusto_type,
       COUNT(*) as total_cases,
       SUM(CASE WHEN c.visit_type = 'ASYNC_TEXT_EMAIL' THEN 1 ELSE 0 END) as async_cases,
       SUM(CASE WHEN c.visit_type IN ('SYNC_PHONE','SYNC_VIDEO','SYNC_IN_PERSON') THEN 1 ELSE 0 END) as sync_cases,
       SUM(CASE WHEN c.visit_type = 'ORDERLY' THEN 1 ELSE 0 END) as orderly_cases,
       SUM(CASE WHEN c.visit_type = 'NO_SHOW' THEN 1 ELSE 0 END) as noshow_cases,
       SUM(CASE WHEN c.visit_type NOT IN ('ASYNC_TEXT_EMAIL','SYNC_PHONE','SYNC_VIDEO','SYNC_IN_PERSON','ORDERLY','NO_SHOW') THEN 1 ELSE 0 END) as other_cases,
       SUM(c.carevalidate_fee) as total_cv,
       SUM(c.contractor_fee) as total_pay,
       SUM(CASE WHEN c.is_flagged = 1 THEN 1 ELSE 0 END) as flagged_count
     FROM consults c
     LEFT JOIN contractors ct ON c.contractor_id = ct.id
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE s.period_key = ?
     GROUP BY c.contractor_id, ct.name, ct.contractor_type, ct.earns_commission, ct.gusto_type
     ORDER BY ct.name`
  ).bind(pk).all<any>()

  // Overall totals
  const totals = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as total_cases,
       SUM(carevalidate_fee) as total_cv,
       SUM(contractor_fee) as total_pay,
       SUM(CASE WHEN visit_type = 'ASYNC_TEXT_EMAIL' THEN 1 ELSE 0 END) as async_cases,
       SUM(CASE WHEN visit_type IN ('SYNC_PHONE','SYNC_VIDEO','SYNC_IN_PERSON') THEN 1 ELSE 0 END) as sync_cases,
       SUM(CASE WHEN visit_type = 'ORDERLY' THEN 1 ELSE 0 END) as orderly_cases,
       SUM(CASE WHEN visit_type = 'NO_SHOW' THEN 1 ELSE 0 END) as noshow_cases,
       SUM(CASE WHEN decision_status = 'DENIED' THEN 1 ELSE 0 END) as denied_cases
     FROM consults c
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE s.period_key = ?`
  ).bind(pk).first<any>()

  // Commission: contractors where earns_commission = 1
  const commissions = await c.env.DB.prepare(
    `SELECT ct.id, ct.name, SUM(c.carevalidate_fee) as cv_total, SUM(c.contractor_fee) as pay_total
     FROM consults c
     JOIN contractors ct ON c.contractor_id = ct.id
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE s.period_key = ? AND ct.earns_commission = 1
     GROUP BY ct.id, ct.name`
  ).bind(pk).all<any>()

  const period = await c.env.DB.prepare(
    'SELECT * FROM upload_sessions WHERE period_key = ? ORDER BY uploaded_at DESC LIMIT 1'
  ).bind(pk).first<any>()

  return c.json({
    period_key: pk,
    period,
    contractors: rows.results,
    totals,
    commissions: commissions.results,
    denied_paid: deniedPaid
  })
})

// ── POST /api/summary/period/:periodKey (update period settings) ───────────────
summary.post('/period/:periodKey', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const pk = c.req.param('periodKey')
  const body = await c.req.json()

  await c.env.DB.prepare(
    `INSERT INTO period_settings (period_key, denied_paid) VALUES (?, ?)
     ON CONFLICT(period_key) DO UPDATE SET denied_paid = excluded.denied_paid, updated_at = CURRENT_TIMESTAMP`
  ).bind(pk, body.denied_paid ? 1 : 0).run()

  return c.json({ success: true })
})

// ── GET /api/paystub/period/:periodKey/:contractorId ──────────────────────────
summary.get('/paystub/period/:periodKey/:contractorId', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { periodKey, contractorId } = c.req.param()

  const contractor = await c.env.DB.prepare(
    'SELECT * FROM contractors WHERE id = ?'
  ).bind(contractorId).first<any>()
  if (!contractor) return c.json({ error: 'Contractor not found' }, 404)

  const consults = await c.env.DB.prepare(
    `SELECT c.* FROM consults c
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE s.period_key = ? AND c.contractor_id = ?
     ORDER BY c.decision_date`
  ).bind(periodKey, contractorId).all<any>()

  const period = await c.env.DB.prepare(
    'SELECT * FROM upload_sessions WHERE period_key = ? ORDER BY uploaded_at DESC LIMIT 1'
  ).bind(periodKey).first<any>()

  const totals = {
    total_cases: consults.results.length,
    total_pay: consults.results.reduce((s: number, r: any) => s + (r.contractor_fee || 0), 0),
    total_cv: consults.results.reduce((s: number, r: any) => s + (r.carevalidate_fee || 0), 0),
  }

  return c.json({ contractor, consults: consults.results, period, totals })
})

// ── GET /api/cv-summary/period/:periodKey ─────────────────────────────────────
summary.get('/cv-summary/period/:periodKey', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const pk = c.req.param('periodKey')

  const byOrg = await c.env.DB.prepare(
    `SELECT organization_name, COUNT(*) as cases, SUM(carevalidate_fee) as total_cv
     FROM consults c
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE s.period_key = ?
     GROUP BY organization_name
     ORDER BY total_cv DESC`
  ).bind(pk).all<any>()

  const byVisitType = await c.env.DB.prepare(
    `SELECT visit_type, COUNT(*) as cases, SUM(carevalidate_fee) as total_cv, SUM(contractor_fee) as total_pay
     FROM consults c
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE s.period_key = ?
     GROUP BY visit_type`
  ).bind(pk).all<any>()

  const totals = await c.env.DB.prepare(
    `SELECT COUNT(*) as total_cases, SUM(carevalidate_fee) as total_cv, SUM(contractor_fee) as total_pay
     FROM consults c
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE s.period_key = ?`
  ).bind(pk).first<any>()

  return c.json({ period_key: pk, by_org: byOrg.results, by_visit_type: byVisitType.results, totals })
})

// ── GET /api/commission/:periodKey ────────────────────────────────────────────
summary.get('/commission/:periodKey', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const pk = c.req.param('periodKey')

  const rows = await c.env.DB.prepare(
    `SELECT ct.id, ct.name, ct.contractor_type,
       COUNT(*) as total_cases,
       SUM(c.carevalidate_fee) as cv_total,
       SUM(c.contractor_fee) as pay_total,
       (SUM(c.carevalidate_fee) - SUM(c.contractor_fee)) as margin
     FROM consults c
     JOIN contractors ct ON c.contractor_id = ct.id
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE s.period_key = ? AND ct.earns_commission = 1
     GROUP BY ct.id, ct.name, ct.contractor_type`
  ).bind(pk).all<any>()

  return c.json(rows.results)
})

// ── GET /api/export/gusto/period/:periodKey ───────────────────────────────────
summary.get('/export/gusto/period/:periodKey', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const pk = c.req.param('periodKey')

  const rows = await c.env.DB.prepare(
    `SELECT ct.name, ct.ein_ssn, ct.gusto_type, ct.email,
       SUM(c.contractor_fee) as total_pay,
       COUNT(*) as total_cases
     FROM consults c
     JOIN contractors ct ON c.contractor_id = ct.id
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE s.period_key = ? AND ct.is_active = 1
     GROUP BY ct.id, ct.name, ct.ein_ssn, ct.gusto_type, ct.email
     HAVING SUM(c.contractor_fee) > 0
     ORDER BY ct.name`
  ).bind(pk).all<any>()

  const headers = ['name', 'ein_ssn', 'gusto_type', 'email', 'total_pay', 'total_cases']
  const csv = [
    headers.join(','),
    ...rows.results.map((r: any) =>
      headers.map(h => {
        const val = (r as any)[h] ?? ''
        return typeof val === 'string' && (val.includes(',') || val.includes('"'))
          ? `"${val.replace(/"/g, '""')}"` : val
      }).join(',')
    )
  ].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="gusto-${pk}.csv"`
    }
  })
})

export default summary
