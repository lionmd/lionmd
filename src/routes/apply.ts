import { Hono } from 'hono'
import { requireAuth } from './auth'

const apply = new Hono<{ Bindings: { DB: D1Database; RESEND_API_KEY: string } }>()

// ── POST /api/apply ───────────────────────────────────────────────────────────
// Public endpoint — candidates submit their application
apply.post('/', async (c) => {
  const body = await c.req.json()
  const { full_name, company_name, email, phone, ein_ssn, contractor_type,
    specialty, source, notes, role_group, states_licensed } = body

  if (!full_name) return c.json({ error: 'Full name required' }, 400)

  // Check if already exists
  if (email) {
    const existing = await c.env.DB.prepare(
      'SELECT id FROM onboarding_candidates WHERE LOWER(email) = LOWER(?)'
    ).bind(email).first<any>()
    if (existing) return c.json({ error: 'An application with this email already exists' }, 409)
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO onboarding_candidates (full_name, company_name, email, phone, ein_ssn,
      contractor_type, specialty, status, source, notes, role_group, states_licensed)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?) RETURNING id`
  ).bind(full_name, company_name || '', email || '', phone || '', ein_ssn || '',
    contractor_type || 'regular', specialty || '', source || 'apply_form',
    notes || '', role_group || '', states_licensed || '').first<any>()

  // Notify admins via email
  if (c.env.RESEND_API_KEY) {
    const admins = await c.env.DB.prepare(
      "SELECT email FROM portal_users WHERE role = 'admin' AND is_active = 1"
    ).all<any>()
    const adminEmails = admins.results.map((a: any) => a.email).filter(Boolean)

    if (adminEmails.length) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Lion MD <no-reply@lion.md>',
          to: adminEmails,
          subject: `New application: ${full_name}`,
          html: `<p>A new provider application has been submitted.</p>
            <ul>
              <li><strong>Name:</strong> ${full_name}</li>
              <li><strong>Email:</strong> ${email || 'N/A'}</li>
              <li><strong>Specialty:</strong> ${specialty || 'N/A'}</li>
              <li><strong>Type:</strong> ${contractor_type || 'regular'}</li>
            </ul>
            <p><a href="https://lionmd-payroll.pages.dev">View in portal</a></p>`
        })
      }).catch(() => {}) // Don't fail on email errors
    }
  }

  return c.json({ success: true, id: result.id }, 201)
})

// ── GET /api/candidate/status ─────────────────────────────────────────────────
// Provider/candidate checks their own onboarding status
apply.get('/candidate/status', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  // Find by contractor_id or email
  let candidate = null

  if (user.contractor_id) {
    candidate = await c.env.DB.prepare(
      'SELECT * FROM onboarding_candidates WHERE converted_contractor_id = ?'
    ).bind(user.contractor_id).first<any>()
  }

  if (!candidate) {
    candidate = await c.env.DB.prepare(
      'SELECT * FROM onboarding_candidates WHERE LOWER(email) = LOWER(?)'
    ).bind(user.email).first<any>()
  }

  if (!candidate) return c.json({ status: 'not_found', message: 'No application found' })

  const documents = await c.env.DB.prepare(
    'SELECT id, doc_type, file_name, uploaded_at FROM onboarding_documents WHERE candidate_id = ?'
  ).bind(candidate.id).all<any>()

  const meetings = await c.env.DB.prepare(
    'SELECT id, title, scheduled_at, meeting_type, status, meeting_link FROM onboarding_meetings WHERE candidate_id = ? ORDER BY scheduled_at'
  ).bind(candidate.id).all<any>()

  return c.json({
    status: candidate.status,
    candidate: {
      id: candidate.id,
      full_name: candidate.full_name,
      status: candidate.status,
      specialty: candidate.specialty,
      contractor_type: candidate.contractor_type,
    },
    documents: documents.results,
    meetings: meetings.results,
    checklist: {
      payroll_sent: candidate.payroll_sent,
      contract_sent: candidate.contract_sent,
      contract_signed: candidate.contract_signed,
      training_scheduled: candidate.training_scheduled,
      training_completed: candidate.training_completed,
      docs_received: candidate.docs_received,
    }
  })
})

export default apply
