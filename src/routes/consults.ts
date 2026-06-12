import { Hono } from 'hono'
import { requireAuth } from './auth'

const consults = new Hono<{ Bindings: { DB: D1Database } }>()

// ── GET /api/consults ─────────────────────────────────────────────────────────
consults.get('/', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const params = c.req.query()
  const page = parseInt(params.page || '1')
  const limit = parseInt(params.limit || '50')
  const offset = (page - 1) * limit

  const conditions: string[] = ['1=1']
  const bindings: any[] = []

  if (params.period_key) {
    conditions.push('s.period_key = ?')
    bindings.push(params.period_key)
  }
  if (params.session_id) {
    conditions.push('c.session_id = ?')
    bindings.push(params.session_id)
  }
  if (params.contractor_id) {
    conditions.push('c.contractor_id = ?')
    bindings.push(params.contractor_id)
  }
  if (params.visit_type) {
    conditions.push('c.visit_type = ?')
    bindings.push(params.visit_type)
  }
  if (params.decision_status) {
    conditions.push('c.decision_status = ?')
    bindings.push(params.decision_status)
  }
  if (params.is_flagged) {
    conditions.push('c.is_flagged = ?')
    bindings.push(params.is_flagged === '1' ? 1 : 0)
  }
  if (params.doctor_name) {
    conditions.push('LOWER(c.doctor_name) LIKE ?')
    bindings.push(`%${params.doctor_name.toLowerCase()}%`)
  }
  if (params.organization_name) {
    conditions.push('LOWER(c.organization_name) LIKE ?')
    bindings.push(`%${params.organization_name.toLowerCase()}%`)
  }
  if (params.date_from) {
    conditions.push('c.decision_date >= ?')
    bindings.push(params.date_from)
  }
  if (params.date_to) {
    conditions.push('c.decision_date <= ?')
    bindings.push(params.date_to)
  }
  if (params.search) {
    conditions.push('(LOWER(c.case_id) LIKE ? OR LOWER(c.doctor_name) LIKE ? OR LOWER(c.patient_name) LIKE ?)')
    const s = `%${params.search.toLowerCase()}%`
    bindings.push(s, s, s)
  }

  const where = conditions.join(' AND ')

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM consults c JOIN upload_sessions s ON c.session_id = s.id WHERE ${where}`
  ).bind(...bindings).first<any>()

  const rows = await c.env.DB.prepare(
    `SELECT c.*, s.period_label, s.period_key, s.period_month, s.period_year
     FROM consults c
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE ${where}
     ORDER BY c.decision_date DESC, c.id DESC
     LIMIT ? OFFSET ?`
  ).bind(...bindings, limit, offset).all<any>()

  return c.json({ data: rows.results, total: countResult?.total ?? 0, page, limit })
})

// ── GET /api/consults/export ──────────────────────────────────────────────────
consults.get('/export', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const params = c.req.query()
  const conditions: string[] = ['1=1']
  const bindings: any[] = []

  if (params.period_key) { conditions.push('s.period_key = ?'); bindings.push(params.period_key) }
  if (params.session_id) { conditions.push('c.session_id = ?'); bindings.push(params.session_id) }
  if (params.contractor_id) { conditions.push('c.contractor_id = ?'); bindings.push(params.contractor_id) }
  if (params.visit_type) { conditions.push('c.visit_type = ?'); bindings.push(params.visit_type) }
  if (params.date_from) { conditions.push('c.decision_date >= ?'); bindings.push(params.date_from) }
  if (params.date_to) { conditions.push('c.decision_date <= ?'); bindings.push(params.date_to) }

  const where = conditions.join(' AND ')
  const rows = await c.env.DB.prepare(
    `SELECT c.*, s.period_label, s.period_key FROM consults c
     JOIN upload_sessions s ON c.session_id = s.id
     WHERE ${where}
     ORDER BY c.decision_date DESC, c.id DESC`
  ).bind(...bindings).all<any>()

  // Build CSV
  const headers = ['case_id', 'case_id_short', 'organization_name', 'patient_name', 'doctor_name',
    'decision_date', 'decision_status', 'visit_type', 'carevalidate_fee', 'contractor_fee',
    'is_flagged', 'flag_reason', 'period_label', 'period_key']
  const csvRows = [headers.join(',')]
  for (const row of rows.results) {
    csvRows.push(headers.map(h => {
      const val = (row as any)[h] ?? ''
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    }).join(','))
  }
  const csv = csvRows.join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="consults-export.csv"`
    }
  })
})

// ── GET /api/consults/doctors ─────────────────────────────────────────────────
consults.get('/doctors', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const period_key = c.req.query('period_key')
  let query = `SELECT DISTINCT c.doctor_name, c.contractor_id, ct.name as contractor_name
    FROM consults c
    LEFT JOIN contractors ct ON c.contractor_id = ct.id
    JOIN upload_sessions s ON c.session_id = s.id
    WHERE c.doctor_name IS NOT NULL AND c.doctor_name != ''`
  const bindings: any[] = []
  if (period_key) { query += ' AND s.period_key = ?'; bindings.push(period_key) }
  query += ' ORDER BY c.doctor_name'

  const rows = await c.env.DB.prepare(query).bind(...bindings).all<any>()
  return c.json(rows.results)
})

// ── GET /api/consults/organizations ──────────────────────────────────────────
consults.get('/organizations', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const period_key = c.req.query('period_key')
  let query = `SELECT DISTINCT organization_name FROM consults c
    JOIN upload_sessions s ON c.session_id = s.id
    WHERE organization_name IS NOT NULL AND organization_name != ''`
  const bindings: any[] = []
  if (period_key) { query += ' AND s.period_key = ?'; bindings.push(period_key) }
  query += ' ORDER BY organization_name'

  const rows = await c.env.DB.prepare(query).bind(...bindings).all<any>()
  return c.json(rows.results.map((r: any) => r.organization_name))
})

// ── GET /api/consults/:id ─────────────────────────────────────────────────────
consults.get('/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const row = await c.env.DB.prepare(
    'SELECT c.*, s.period_label, s.period_key FROM consults c JOIN upload_sessions s ON c.session_id = s.id WHERE c.id = ?'
  ).bind(c.req.param('id')).first<any>()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

// ── PUT /api/consults/:id ─────────────────────────────────────────────────────
consults.put('/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const body = await c.req.json()

  const fields: string[] = []
  const vals: any[] = []

  const allowed = ['doctor_name', 'patient_name', 'organization_name', 'decision_date',
    'decision_status', 'visit_type', 'carevalidate_fee', 'contractor_fee',
    'contractor_id', 'is_flagged', 'flag_reason', 'is_override', 'override_fee', 'notes']

  for (const key of allowed) {
    if (key in body) { fields.push(`${key} = ?`); vals.push(body[key]) }
  }
  if (!fields.length) return c.json({ error: 'No fields to update' }, 400)

  vals.push(id)
  await c.env.DB.prepare(`UPDATE consults SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run()
  return c.json({ success: true })
})

// ── DELETE /api/consults/:id ──────────────────────────────────────────────────
consults.delete('/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  await c.env.DB.prepare('DELETE FROM consults WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ── POST /api/doctors/match ───────────────────────────────────────────────────
consults.post('/doctors/match', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { doctor_name, contractor_id, period_key } = await c.req.json()
  if (!doctor_name || !contractor_id) return c.json({ error: 'Missing fields' }, 400)

  let query = `UPDATE consults SET contractor_id = ?
    FROM (SELECT c.id FROM consults c JOIN upload_sessions s ON c.session_id = s.id
          WHERE LOWER(c.doctor_name) = LOWER(?)`
  const bindings: any[] = [contractor_id, doctor_name]

  if (period_key) { query += ` AND s.period_key = ?`; bindings.push(period_key) }
  query += `) sub WHERE consults.id = sub.id`

  // SQLite-compatible version
  let updateQuery = `UPDATE consults SET contractor_id = ?
    WHERE LOWER(doctor_name) = LOWER(?)`
  const updateBindings: any[] = [contractor_id, doctor_name]
  if (period_key) {
    updateQuery += ` AND session_id IN (SELECT id FROM upload_sessions WHERE period_key = ?)`
    updateBindings.push(period_key)
  }

  const result = await c.env.DB.prepare(updateQuery).bind(...updateBindings).run()
  return c.json({ success: true, updated: result.meta?.changes ?? 0 })
})

// ── POST /api/doctors/quick-add ───────────────────────────────────────────────
consults.post('/doctors/quick-add', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { doctor_name, period_key } = await c.req.json()
  if (!doctor_name) return c.json({ error: 'Doctor name required' }, 400)

  // Create a new contractor for this doctor
  const nameParts = doctor_name.trim().split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  const result = await c.env.DB.prepare(
    `INSERT INTO contractors (name, first_name, last_name, is_active, contractor_type)
     VALUES (?, ?, ?, 1, 'regular') RETURNING id`
  ).bind(doctor_name.trim(), firstName, lastName).first<any>()

  const contractorId = result.id

  // Match unmatched consults
  let updateQuery = `UPDATE consults SET contractor_id = ?
    WHERE LOWER(doctor_name) = LOWER(?) AND contractor_id IS NULL`
  const bindings: any[] = [contractorId, doctor_name]
  if (period_key) {
    updateQuery += ` AND session_id IN (SELECT id FROM upload_sessions WHERE period_key = ?)`
    bindings.push(period_key)
  }
  await c.env.DB.prepare(updateQuery).bind(...bindings).run()

  return c.json({ success: true, contractor_id: contractorId })
})

export default consults
