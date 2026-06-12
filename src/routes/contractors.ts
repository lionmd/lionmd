import { Hono } from 'hono'
import { requireAuth } from './auth'

const contractors = new Hono<{ Bindings: { DB: D1Database } }>()

const CONTRACTOR_FIELDS = `id, name, first_name, last_name, company, ein_ssn, email, phone,
  is_active, contractor_type, gusto_type, earns_commission, role_group,
  cv_url, cv_filename, cv_updated_at, bio, address, npi, specialty, states_licensed,
  photo_data, photo_mime, photo_updated_at, created_at`

// ── GET /api/contractors ───────────────────────────────────────────────────────
contractors.get('/', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    `SELECT ${CONTRACTOR_FIELDS} FROM contractors WHERE is_active = 1 ORDER BY name`
  ).all<any>()
  return c.json(rows.results)
})

// ── GET /api/contractors/all ───────────────────────────────────────────────────
contractors.get('/all', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    `SELECT ${CONTRACTOR_FIELDS} FROM contractors ORDER BY is_active DESC, name`
  ).all<any>()
  return c.json(rows.results)
})

// ── POST /api/contractors ──────────────────────────────────────────────────────
contractors.post('/', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { name, first_name, last_name, company, ein_ssn, email, phone,
    contractor_type, gusto_type, earns_commission, role_group, npi, specialty, states_licensed } = body

  if (!name) return c.json({ error: 'Name required' }, 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO contractors (name, first_name, last_name, company, ein_ssn, email, phone,
      contractor_type, gusto_type, earns_commission, role_group, npi, specialty, states_licensed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(name, first_name || '', last_name || '', company || '', ein_ssn || '',
    email || '', phone || '', contractor_type || 'regular', gusto_type || 'Individual',
    earns_commission ? 1 : 0, role_group || '', npi || '', specialty || '', states_licensed || '')
    .first<any>()

  return c.json({ id: result.id, ...body }, 201)
})

// ── GET /api/contractors/:id ───────────────────────────────────────────────────
contractors.get('/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const row = await c.env.DB.prepare(
    `SELECT ${CONTRACTOR_FIELDS} FROM contractors WHERE id = ?`
  ).bind(c.req.param('id')).first<any>()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

// ── PUT /api/contractors/:id ───────────────────────────────────────────────────
contractors.put('/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const body = await c.req.json()

  const allowed = ['name', 'first_name', 'last_name', 'company', 'ein_ssn', 'email', 'phone',
    'is_active', 'contractor_type', 'gusto_type', 'earns_commission', 'role_group',
    'bio', 'address', 'npi', 'specialty', 'states_licensed']

  const fields: string[] = []
  const vals: any[] = []
  for (const key of allowed) {
    if (key in body) { fields.push(`${key} = ?`); vals.push(body[key]) }
  }
  if (!fields.length) return c.json({ error: 'No fields to update' }, 400)

  vals.push(id)
  await c.env.DB.prepare(`UPDATE contractors SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run()
  return c.json({ success: true })
})

// ── PATCH /api/contractors/:id/toggle-active ──────────────────────────────────
contractors.patch('/:id/toggle-active', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const current = await c.env.DB.prepare('SELECT is_active FROM contractors WHERE id = ?').bind(id).first<any>()
  if (!current) return c.json({ error: 'Not found' }, 404)

  const newVal = 'is_active' in body ? (body.is_active ? 1 : 0) : (current.is_active ? 0 : 1)
  await c.env.DB.prepare('UPDATE contractors SET is_active = ? WHERE id = ?').bind(newVal, id).run()
  return c.json({ success: true, is_active: newVal })
})

// ── GET /api/contractors/:id/history ──────────────────────────────────────────
contractors.get('/:id/history', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const rows = await c.env.DB.prepare(
    `SELECT c.*, s.period_label, s.period_key FROM consults c
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE c.contractor_id = ?
     ORDER BY c.decision_date DESC, c.id DESC`
  ).bind(id).all<any>()
  return c.json(rows.results)
})

// ── POST /api/contractors/merge ────────────────────────────────────────────────
contractors.post('/merge', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { keep_id, merge_ids } = await c.req.json()
  if (!keep_id || !merge_ids?.length) return c.json({ error: 'Missing fields' }, 400)

  const stmts = []
  for (const mid of merge_ids) {
    stmts.push(c.env.DB.prepare('UPDATE consults SET contractor_id = ? WHERE contractor_id = ?').bind(keep_id, mid))
    stmts.push(c.env.DB.prepare('UPDATE portal_users SET contractor_id = ? WHERE contractor_id = ?').bind(keep_id, mid))
    stmts.push(c.env.DB.prepare('DELETE FROM contractors WHERE id = ?').bind(mid))
  }
  await c.env.DB.batch(stmts)
  return c.json({ success: true })
})

// ── POST /api/admin/contractors/migrate ────────────────────────────────────────
contractors.post('/migrate', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  // Re-match all unmatched consults to contractors by doctor name
  const allContractors = await c.env.DB.prepare('SELECT id, name, first_name, last_name FROM contractors WHERE is_active = 1').all<any>()
  let matched = 0

  for (const contractor of allContractors.results) {
    const fullName = contractor.name || `${contractor.first_name} ${contractor.last_name}`.trim()
    const result = await c.env.DB.prepare(
      `UPDATE consults SET contractor_id = ?
       WHERE contractor_id IS NULL AND LOWER(doctor_name) = LOWER(?)`
    ).bind(contractor.id, fullName).run()
    matched += result.meta?.changes ?? 0
  }

  return c.json({ success: true, matched })
})

// ── GET /api/admin/contractors/:id/full-profile ────────────────────────────────
contractors.get('/:id/full-profile', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const contractor = await c.env.DB.prepare(
    `SELECT * FROM contractors WHERE id = ?`
  ).bind(id).first<any>()
  if (!contractor) return c.json({ error: 'Not found' }, 404)

  const licenses = await c.env.DB.prepare(
    'SELECT * FROM provider_licenses WHERE contractor_id = ? ORDER BY state'
  ).bind(id).all<any>()

  const documents = await c.env.DB.prepare(
    'SELECT id, doc_type, file_name, file_size, mime_type, notes, uploaded_by, uploaded_at FROM contractor_documents WHERE contractor_id = ? ORDER BY uploaded_at DESC'
  ).bind(id).all<any>()

  const portal_user = await c.env.DB.prepare(
    'SELECT id, email, name, role, is_active FROM portal_users WHERE contractor_id = ?'
  ).bind(id).first<any>()

  return c.json({ ...contractor, licenses: licenses.results, documents: documents.results, portal_user })
})

// ── GET /api/admin/contractors/:id/licenses ────────────────────────────────────
contractors.get('/:id/licenses', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    'SELECT * FROM provider_licenses WHERE contractor_id = ? ORDER BY state'
  ).bind(c.req.param('id')).all<any>()
  return c.json(rows.results)
})

// ── POST /api/admin/contractors/:id/licenses ───────────────────────────────────
contractors.post('/:id/licenses', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { state, license_number, license_type, expiry_date, status, notes } = await c.req.json()

  const result = await c.env.DB.prepare(
    `INSERT INTO provider_licenses (contractor_id, state, license_number, license_type, expiry_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(id, state || '', license_number || '', license_type || '', expiry_date || '', status || 'active', notes || '')
    .first<any>()

  return c.json({ id: result.id }, 201)
})

// ── PUT /api/admin/licenses/:id ────────────────────────────────────────────────
contractors.put('/licenses/:licId', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { state, license_number, license_type, expiry_date, status, notes } = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE provider_licenses SET state = ?, license_number = ?, license_type = ?, expiry_date = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(state || '', license_number || '', license_type || '', expiry_date || '', status || 'active', notes || '', c.req.param('licId')).run()

  return c.json({ success: true })
})

// ── DELETE /api/admin/licenses/:id ────────────────────────────────────────────
contractors.delete('/licenses/:licId', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  await c.env.DB.prepare('DELETE FROM provider_licenses WHERE id = ?').bind(c.req.param('licId')).run()
  return c.json({ success: true })
})

// ── GET /api/admin/contractors/:id/documents ───────────────────────────────────
contractors.get('/:id/documents', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    'SELECT id, doc_type, file_name, file_size, mime_type, notes, uploaded_by, uploaded_at FROM contractor_documents WHERE contractor_id = ? ORDER BY uploaded_at DESC'
  ).bind(c.req.param('id')).all<any>()
  return c.json(rows.results)
})

// ── POST /api/admin/contractors/:id/documents ──────────────────────────────────
contractors.post('/:id/documents', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { doc_type, file_name, file_data, file_size, mime_type, notes } = await c.req.json()
  if (!file_name || !file_data) return c.json({ error: 'Missing file data' }, 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO contractor_documents (contractor_id, doc_type, file_name, file_data, file_size, mime_type, notes, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(id, doc_type || 'other', file_name, file_data, file_size || 0, mime_type || 'application/octet-stream',
    notes || '', user.name || user.email).first<any>()

  return c.json({ id: result.id }, 201)
})

// ── GET /api/admin/contractor-documents/:id (download) ────────────────────────
contractors.get('/documents/:docId', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const doc = await c.env.DB.prepare(
    'SELECT * FROM contractor_documents WHERE id = ?'
  ).bind(c.req.param('docId')).first<any>()
  if (!doc) return c.json({ error: 'Not found' }, 404)
  return c.json(doc)
})

// ── DELETE /api/admin/contractor-documents/:id ────────────────────────────────
contractors.delete('/documents/:docId', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  await c.env.DB.prepare('DELETE FROM contractor_documents WHERE id = ?').bind(c.req.param('docId')).run()
  return c.json({ success: true })
})

export default contractors
