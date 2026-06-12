import { Hono } from 'hono'
import { requireAuth } from './auth'

const provider = new Hono<{ Bindings: { DB: D1Database } }>()

// ── GET /api/provider/profile ─────────────────────────────────────────────────
provider.get('/profile', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (!['provider', 'admin'].includes(user.role)) return c.json({ error: 'Forbidden' }, 403)

  if (!user.contractor_id) return c.json({ error: 'No contractor profile linked' }, 404)

  const contractor = await c.env.DB.prepare('SELECT * FROM contractors WHERE id = ?').bind(user.contractor_id).first<any>()
  if (!contractor) return c.json({ error: 'Profile not found' }, 404)

  return c.json({
    ...contractor,
    portal_email: user.email,
    portal_name: user.name
  })
})

// ── PUT /api/provider/profile ─────────────────────────────────────────────────
provider.put('/profile', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || !user.contractor_id) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const allowed = ['bio', 'address', 'phone', 'specialty', 'states_licensed', 'npi']

  const fields: string[] = []
  const vals: any[] = []
  for (const key of allowed) {
    if (key in body) { fields.push(`${key} = ?`); vals.push(body[key]) }
  }

  // Allow email update on portal_users
  if (body.email) {
    await c.env.DB.prepare('UPDATE portal_users SET email = ? WHERE id = ?').bind(body.email, user.id).run()
  }

  if (fields.length) {
    vals.push(user.contractor_id)
    await c.env.DB.prepare(`UPDATE contractors SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run()
  }

  return c.json({ success: true })
})

// ── POST /api/provider/photo ──────────────────────────────────────────────────
provider.post('/photo', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || !user.contractor_id) return c.json({ error: 'Unauthorized' }, 401)

  const { data_url, mime } = await c.req.json()
  if (!data_url) return c.json({ error: 'Missing photo data' }, 400)

  await c.env.DB.prepare(
    'UPDATE contractors SET photo_data = ?, photo_mime = ?, photo_updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(data_url, mime || 'image/jpeg', user.contractor_id).run()

  return c.json({ success: true })
})

// ── POST /api/provider/cv ─────────────────────────────────────────────────────
provider.post('/cv', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || !user.contractor_id) return c.json({ error: 'Unauthorized' }, 401)

  const { filename, data_url } = await c.req.json()
  if (!data_url) return c.json({ error: 'Missing CV data' }, 400)

  await c.env.DB.prepare(
    'UPDATE contractors SET cv_filename = ?, cv_url = ?, cv_updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(filename || 'cv.pdf', data_url, user.contractor_id).run()

  return c.json({ success: true })
})

// ── GET /api/provider/payroll ─────────────────────────────────────────────────
provider.get('/payroll', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || !user.contractor_id) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    `SELECT s.period_key, s.period_label, s.period_month, s.period_year,
       COUNT(c.id) as total_cases,
       SUM(c.contractor_fee) as total_pay,
       SUM(CASE WHEN c.visit_type = 'ASYNC_TEXT_EMAIL' THEN 1 ELSE 0 END) as async_cases,
       SUM(CASE WHEN c.visit_type IN ('SYNC_PHONE','SYNC_VIDEO','SYNC_IN_PERSON') THEN 1 ELSE 0 END) as sync_cases,
       SUM(CASE WHEN c.visit_type = 'ORDERLY' THEN 1 ELSE 0 END) as orderly_cases
     FROM consults c
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE c.contractor_id = ?
     GROUP BY s.period_key, s.period_label, s.period_month, s.period_year
     ORDER BY s.period_year DESC, s.period_month DESC`
  ).bind(user.contractor_id).all<any>()

  const totals = {
    total_cases: rows.results.reduce((s: number, r: any) => s + (r.total_cases || 0), 0),
    total_pay: rows.results.reduce((s: number, r: any) => s + (r.total_pay || 0), 0),
  }

  return c.json({ periods: rows.results, totals })
})

// ── GET /api/provider/consults ────────────────────────────────────────────────
provider.get('/consults', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || !user.contractor_id) return c.json({ error: 'Unauthorized' }, 401)

  const params = c.req.query()
  const conditions = ['c.contractor_id = ?']
  const bindings: any[] = [user.contractor_id]

  if (params.period_key) { conditions.push('s.period_key = ?'); bindings.push(params.period_key) }

  const rows = await c.env.DB.prepare(
    `SELECT c.*, s.period_label, s.period_key FROM consults c
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.decision_date DESC LIMIT 500`
  ).bind(...bindings).all<any>()

  return c.json({ data: rows.results, total: rows.results.length })
})

// ── GET /api/provider/licenses ────────────────────────────────────────────────
provider.get('/licenses', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || !user.contractor_id) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    'SELECT * FROM provider_licenses WHERE contractor_id = ? ORDER BY state'
  ).bind(user.contractor_id).all<any>()
  return c.json(rows.results)
})

// ── POST /api/provider/licenses ───────────────────────────────────────────────
provider.post('/licenses', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || !user.contractor_id) return c.json({ error: 'Unauthorized' }, 401)

  const { state, license_number, license_type, expiry_date, status, notes } = await c.req.json()
  const result = await c.env.DB.prepare(
    `INSERT INTO provider_licenses (contractor_id, state, license_number, license_type, expiry_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(user.contractor_id, state || '', license_number || '', license_type || '',
    expiry_date || '', status || 'active', notes || '').first<any>()

  return c.json({ id: result.id }, 201)
})

// ── PUT /api/provider/licenses/:id ────────────────────────────────────────────
provider.put('/licenses/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || !user.contractor_id) return c.json({ error: 'Unauthorized' }, 401)

  const { state, license_number, license_type, expiry_date, status, notes } = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE provider_licenses SET state = ?, license_number = ?, license_type = ?, expiry_date = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND contractor_id = ?`
  ).bind(state || '', license_number || '', license_type || '', expiry_date || '',
    status || 'active', notes || '', c.req.param('id'), user.contractor_id).run()

  return c.json({ success: true })
})

// ── DELETE /api/provider/licenses/:id ─────────────────────────────────────────
provider.delete('/licenses/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || !user.contractor_id) return c.json({ error: 'Unauthorized' }, 401)

  await c.env.DB.prepare(
    'DELETE FROM provider_licenses WHERE id = ? AND contractor_id = ?'
  ).bind(c.req.param('id'), user.contractor_id).run()

  return c.json({ success: true })
})

export default provider
