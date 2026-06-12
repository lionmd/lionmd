import { Hono } from 'hono'
import { requireAuth } from './auth'

const onboarding = new Hono<{ Bindings: { DB: D1Database; RESEND_API_KEY: string } }>()

// ── GET /api/onboarding/stats ─────────────────────────────────────────────────
onboarding.get('/stats', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const totals = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
       SUM(CASE WHEN status = 'screening' THEN 1 ELSE 0 END) as screening_count,
       SUM(CASE WHEN status = 'interview' THEN 1 ELSE 0 END) as interview_count,
       SUM(CASE WHEN status = 'hired' THEN 1 ELSE 0 END) as hired_count,
       SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
       SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_count
     FROM onboarding_candidates`
  ).first<any>()

  return c.json(totals)
})

// ── GET /api/onboarding/candidates ────────────────────────────────────────────
onboarding.get('/candidates', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const params = c.req.query()
  const conditions: string[] = ['1=1']
  const bindings: any[] = []

  if (params.status && params.status !== 'all') {
    conditions.push('status = ?'); bindings.push(params.status)
  }
  if (params.search) {
    conditions.push('(LOWER(full_name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(specialty) LIKE ?)')
    const s = `%${params.search.toLowerCase()}%`
    bindings.push(s, s, s)
  }

  const where = conditions.join(' AND ')
  const rows = await c.env.DB.prepare(
    `SELECT id, full_name, company_name, email, phone, contractor_type, specialty, status,
            source, notes, created_at, updated_at, converted_contractor_id, role_group, states_licensed,
            payroll_sent, contract_sent, contract_signed, training_scheduled, training_completed, docs_received
     FROM onboarding_candidates WHERE ${where} ORDER BY created_at DESC`
  ).bind(...bindings).all<any>()

  return c.json(rows.results)
})

// ── POST /api/onboarding/candidates ───────────────────────────────────────────
onboarding.post('/candidates', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { full_name, company_name, email, phone, ein_ssn, contractor_type, specialty,
    status, source, notes, role_group, states_licensed } = body

  if (!full_name) return c.json({ error: 'Full name required' }, 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO onboarding_candidates (full_name, company_name, email, phone, ein_ssn, contractor_type,
      specialty, status, source, notes, role_group, states_licensed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(full_name, company_name || '', email || '', phone || '', ein_ssn || '',
    contractor_type || 'regular', specialty || '', status || 'new', source || '',
    notes || '', role_group || '', states_licensed || '').first<any>()

  return c.json({ id: result.id, ...body }, 201)
})

// ── GET /api/onboarding/candidates/:id ────────────────────────────────────────
onboarding.get('/candidates/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const candidate = await c.env.DB.prepare('SELECT * FROM onboarding_candidates WHERE id = ?').bind(c.req.param('id')).first<any>()
  if (!candidate) return c.json({ error: 'Not found' }, 404)
  return c.json(candidate)
})

// ── PUT /api/onboarding/candidates/:id ────────────────────────────────────────
onboarding.put('/candidates/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const body = await c.req.json()

  const allowed = ['full_name', 'company_name', 'email', 'phone', 'ein_ssn', 'contractor_type',
    'specialty', 'status', 'source', 'notes', 'resume_text', 'resume_summary', 'resume_key_points',
    'payroll_sent', 'payroll_sent_at', 'contract_sent', 'contract_sent_at', 'contract_signed', 'contract_signed_at',
    'training_scheduled', 'training_scheduled_at', 'training_completed', 'training_completed_at',
    'docs_received', 'docs_received_at', 'role_group', 'states_licensed', 'photo_data', 'photo_mime']

  const fields: string[] = ['updated_at = CURRENT_TIMESTAMP']
  const vals: any[] = []
  for (const key of allowed) {
    if (key in body) { fields.push(`${key} = ?`); vals.push(body[key]) }
  }

  vals.push(id)
  await c.env.DB.prepare(`UPDATE onboarding_candidates SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run()
  return c.json({ success: true })
})

// ── DELETE /api/onboarding/candidates/:id ─────────────────────────────────────
onboarding.delete('/candidates/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  await c.env.DB.prepare('DELETE FROM onboarding_candidates WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ── POST /api/onboarding/candidates/:id/analyze-resume ───────────────────────
onboarding.post('/candidates/:id/analyze-resume', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { resume_text } = await c.req.json()
  if (!resume_text) return c.json({ error: 'Resume text required' }, 400)

  // Simple keyword extraction as summary (no AI API needed)
  const lines = resume_text.split('\n').filter((l: string) => l.trim().length > 10)
  const summary = lines.slice(0, 3).join(' ').substring(0, 300)
  const key_points = lines.slice(0, 10).map((l: string) => l.trim()).filter(Boolean)

  await c.env.DB.prepare(
    'UPDATE onboarding_candidates SET resume_text = ?, resume_summary = ?, resume_key_points = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(resume_text, summary, JSON.stringify(key_points), c.req.param('id')).run()

  return c.json({ summary, key_points })
})

// ── POST /api/onboarding/candidates/:id/convert ───────────────────────────────
onboarding.post('/candidates/:id/convert', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const candidate = await c.env.DB.prepare('SELECT * FROM onboarding_candidates WHERE id = ?').bind(id).first<any>()
  if (!candidate) return c.json({ error: 'Not found' }, 404)

  // Create contractor from candidate
  const nameParts = candidate.full_name.trim().split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  const result = await c.env.DB.prepare(
    `INSERT INTO contractors (name, first_name, last_name, company, ein_ssn, email, phone,
      contractor_type, specialty, role_group, states_licensed, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) RETURNING id`
  ).bind(candidate.full_name, firstName, lastName, candidate.company_name || '',
    candidate.ein_ssn || '', candidate.email || '', candidate.phone || '',
    candidate.contractor_type || 'regular', candidate.specialty || '',
    candidate.role_group || '', candidate.states_licensed || '').first<any>()

  const contractorId = result.id

  await c.env.DB.prepare(
    'UPDATE onboarding_candidates SET status = ?, converted_contractor_id = ?, converted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind('converted', contractorId, id).run()

  return c.json({ success: true, contractor_id: contractorId })
})

// ── POST /api/admin/onboarding/candidates/:id/send-invite ────────────────────
onboarding.post('/candidates/:id/send-invite', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const candidate = await c.env.DB.prepare('SELECT * FROM onboarding_candidates WHERE id = ?').bind(c.req.param('id')).first<any>()
  if (!candidate) return c.json({ error: 'Not found' }, 404)
  if (!candidate.email) return c.json({ error: 'Candidate has no email' }, 400)

  const applyUrl = `https://lionmd-payroll.pages.dev/apply?ref=${candidate.id}`

  if (c.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Lion MD <no-reply@lion.md>',
        to: candidate.email,
        subject: 'Complete your Lion MD application',
        html: `<p>Hi ${candidate.full_name},</p><p>Please complete your application at the link below:</p><p><a href="${applyUrl}">${applyUrl}</a></p>`
      })
    })
  }

  return c.json({ success: true })
})

// ── GET /api/onboarding/candidates/:id/documents ──────────────────────────────
onboarding.get('/candidates/:id/documents', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    'SELECT id, doc_type, file_name, file_size, mime_type, uploaded_at FROM onboarding_documents WHERE candidate_id = ? ORDER BY uploaded_at DESC'
  ).bind(c.req.param('id')).all<any>()
  return c.json(rows.results)
})

// ── POST /api/onboarding/candidates/:id/documents ─────────────────────────────
onboarding.post('/candidates/:id/documents', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { doc_type, file_name, file_data, file_size, mime_type } = await c.req.json()
  if (!file_name || !file_data) return c.json({ error: 'Missing file data' }, 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO onboarding_documents (candidate_id, doc_type, file_name, file_data, file_size, mime_type)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(c.req.param('id'), doc_type || 'other', file_name, file_data, file_size || 0, mime_type || 'application/octet-stream').first<any>()

  return c.json({ id: result.id }, 201)
})

// ── GET /api/onboarding/documents/:id ────────────────────────────────────────
onboarding.get('/documents/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const doc = await c.env.DB.prepare('SELECT * FROM onboarding_documents WHERE id = ?').bind(c.req.param('id')).first<any>()
  if (!doc) return c.json({ error: 'Not found' }, 404)
  return c.json(doc)
})

// ── DELETE /api/onboarding/documents/:id ──────────────────────────────────────
onboarding.delete('/documents/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  await c.env.DB.prepare('DELETE FROM onboarding_documents WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ── GET /api/onboarding/candidates/:id/meetings ───────────────────────────────
onboarding.get('/candidates/:id/meetings', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    'SELECT * FROM onboarding_meetings WHERE candidate_id = ? ORDER BY scheduled_at'
  ).bind(c.req.param('id')).all<any>()
  return c.json(rows.results)
})

// ── POST /api/onboarding/candidates/:id/meetings ──────────────────────────────
onboarding.post('/candidates/:id/meetings', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { title, scheduled_at, duration_min, meeting_link, meeting_type, status, notes } = body

  const result = await c.env.DB.prepare(
    `INSERT INTO onboarding_meetings (candidate_id, title, scheduled_at, duration_min, meeting_link, meeting_type, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(c.req.param('id'), title || 'Interview', scheduled_at || null, duration_min || 30,
    meeting_link || '', meeting_type || 'interview', status || 'scheduled', notes || '').first<any>()

  return c.json({ id: result.id }, 201)
})

// ── DELETE /api/onboarding/meetings/:id ───────────────────────────────────────
onboarding.delete('/meetings/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  await c.env.DB.prepare('DELETE FROM onboarding_meetings WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ── GET /api/onboarding/availability ─────────────────────────────────────────
onboarding.get('/availability', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    'SELECT * FROM onboarding_availability WHERE is_active = 1 ORDER BY day_of_week, start_time'
  ).all<any>()
  return c.json(rows.results)
})

// ── POST /api/onboarding/availability ────────────────────────────────────────
onboarding.post('/availability', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { day_of_week, date, start_time, end_time, label } = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO onboarding_availability (day_of_week, date, start_time, end_time, label) VALUES (?, ?, ?, ?, ?) RETURNING id'
  ).bind(day_of_week ?? null, date || null, start_time, end_time, label || '').first<any>()

  return c.json({ id: result.id }, 201)
})

// ── DELETE /api/onboarding/availability/:id ───────────────────────────────────
onboarding.delete('/availability/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  await c.env.DB.prepare('UPDATE onboarding_availability SET is_active = 0 WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ── GET /api/onboarding/calendar ──────────────────────────────────────────────
onboarding.get('/calendar', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const meetings = await c.env.DB.prepare(
    `SELECT m.*, oc.full_name as candidate_name, oc.email as candidate_email
     FROM onboarding_meetings m
     JOIN onboarding_candidates oc ON m.candidate_id = oc.id
     WHERE m.scheduled_at >= date('now', '-30 days')
     ORDER BY m.scheduled_at`
  ).all<any>()

  const availability = await c.env.DB.prepare(
    'SELECT * FROM onboarding_availability WHERE is_active = 1 ORDER BY day_of_week, start_time'
  ).all<any>()

  return c.json({ meetings: meetings.results, availability: availability.results })
})

// ── GET /api/onboarding/templates ────────────────────────────────────────────
onboarding.get('/templates', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare('SELECT id, name, is_default, created_at, updated_at FROM contract_templates ORDER BY is_default DESC, name').all<any>()
  return c.json(rows.results)
})

// ── POST /api/onboarding/templates ───────────────────────────────────────────
onboarding.post('/templates', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { name, content, is_default } = await c.req.json()
  if (!name || !content) return c.json({ error: 'Name and content required' }, 400)

  if (is_default) {
    await c.env.DB.prepare('UPDATE contract_templates SET is_default = 0').run()
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO contract_templates (name, content, is_default) VALUES (?, ?, ?) RETURNING id'
  ).bind(name, content, is_default ? 1 : 0).first<any>()

  return c.json({ id: result.id }, 201)
})

// ── GET /api/onboarding/templates/:id ────────────────────────────────────────
onboarding.get('/templates/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const row = await c.env.DB.prepare('SELECT * FROM contract_templates WHERE id = ?').bind(c.req.param('id')).first<any>()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

// ── PUT /api/onboarding/templates/:id ────────────────────────────────────────
onboarding.put('/templates/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { name, content, is_default } = await c.req.json()
  if (is_default) {
    await c.env.DB.prepare('UPDATE contract_templates SET is_default = 0').run()
  }
  await c.env.DB.prepare(
    'UPDATE contract_templates SET name = COALESCE(?, name), content = COALESCE(?, content), is_default = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(name ?? null, content ?? null, is_default ? 1 : 0, c.req.param('id')).run()
  return c.json({ success: true })
})

// ── DELETE /api/onboarding/templates/:id ─────────────────────────────────────
onboarding.delete('/templates/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  await c.env.DB.prepare('DELETE FROM contract_templates WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ── POST /api/onboarding/templates/:id/fill ───────────────────────────────────
onboarding.post('/templates/:id/fill', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const template = await c.env.DB.prepare('SELECT * FROM contract_templates WHERE id = ?').bind(c.req.param('id')).first<any>()
  if (!template) return c.json({ error: 'Template not found' }, 404)

  const { full_name, company_name, ein_ssn, email, phone, specialty } = await c.req.json()

  let content = template.content
  const replacements: Record<string, string> = {
    '{{full_name}}': full_name || '',
    '{{name}}': full_name || '',
    '{{company_name}}': company_name || '',
    '{{company}}': company_name || '',
    '{{ein_ssn}}': ein_ssn || '',
    '{{email}}': email || '',
    '{{phone}}': phone || '',
    '{{specialty}}': specialty || '',
    '{{date}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  }

  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replaceAll(placeholder, value)
  }

  return c.json({ content, name: template.name })
})

export default onboarding
