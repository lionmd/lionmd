import { Hono } from 'hono'
import { requireAuth } from './auth'

const admin = new Hono<{ Bindings: { DB: D1Database; RESEND_API_KEY: string } }>()

function generateToken(): string {
  const arr = new Uint8Array(24)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

// ── GET /api/admin/users ──────────────────────────────────────────────────────
admin.get('/users', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.is_active, u.must_set_password,
            u.last_login, u.created_at, u.contractor_id, u.phone,
            c.name as contractor_name
     FROM portal_users u
     LEFT JOIN contractors c ON u.contractor_id = c.id
     ORDER BY u.created_at DESC`
  ).all<any>()
  return c.json(rows.results)
})

// ── POST /api/admin/users ─────────────────────────────────────────────────────
admin.post('/users', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { email, name, role, contractor_id, phone } = await c.req.json()
  if (!email || !name || !role) return c.json({ error: 'Email, name, and role required' }, 400)

  const inviteToken = generateToken()
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const result = await c.env.DB.prepare(
    `INSERT INTO portal_users (email, name, role, contractor_id, phone, invite_token, invite_token_expires, must_set_password, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?) RETURNING id`
  ).bind(email.toLowerCase().trim(), name, role, contractor_id || null, phone || '',
    inviteToken, expires, user.id).first<any>()

  return c.json({ id: result.id, invite_token: inviteToken }, 201)
})

// ── PUT /api/admin/users/:id ──────────────────────────────────────────────────
admin.put('/users/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const body = await c.req.json()
  const allowed = ['email', 'name', 'role', 'is_active', 'contractor_id', 'phone']

  const fields: string[] = ['updated_at = CURRENT_TIMESTAMP']
  const vals: any[] = []
  for (const key of allowed) {
    if (key in body) { fields.push(`${key} = ?`); vals.push(body[key]) }
  }

  vals.push(id)
  await c.env.DB.prepare(`UPDATE portal_users SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run()
  return c.json({ success: true })
})

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
admin.delete('/users/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  if (parseInt(id) === user.id) return c.json({ error: 'Cannot delete your own account' }, 400)

  await c.env.DB.prepare('DELETE FROM portal_users WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ── PUT /api/admin/users/:id/link-contractor ──────────────────────────────────
admin.put('/users/:id/link-contractor', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { contractor_id } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE portal_users SET contractor_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(contractor_id || null, c.req.param('id')).run()
  return c.json({ success: true })
})

// ── POST /api/admin/users/:id/reset-invite ────────────────────────────────────
admin.post('/users/:id/reset-invite', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const token = generateToken()
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'UPDATE portal_users SET invite_token = ?, invite_token_expires = ?, must_set_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(token, expires, c.req.param('id')).run()

  return c.json({ invite_token: token })
})

// ── POST /api/admin/send-invite-email ─────────────────────────────────────────
admin.post('/send-invite-email', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { user_id } = await c.req.json()
  const invitee = await c.env.DB.prepare(
    'SELECT * FROM portal_users WHERE id = ?'
  ).bind(user_id).first<any>()
  if (!invitee) return c.json({ error: 'User not found' }, 404)

  // Generate fresh invite token if needed
  let token = invitee.invite_token
  if (!token || new Date(invitee.invite_token_expires) < new Date()) {
    token = generateToken()
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await c.env.DB.prepare(
      'UPDATE portal_users SET invite_token = ?, invite_token_expires = ?, must_set_password = 1 WHERE id = ?'
    ).bind(token, expires, user_id).run()
  }

  const inviteUrl = `https://lionmd-payroll.pages.dev/login?invite=${token}`

  if (c.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Lion MD <no-reply@lion.md>',
        to: invitee.email,
        subject: 'You\'ve been invited to Lion MD',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <img src="https://lionmd-payroll.pages.dev/static/lion-logo-black.png" alt="Lion MD" style="height:48px; margin-bottom: 24px;" />
            <h2>Welcome to Lion MD, ${invitee.name}!</h2>
            <p>You've been invited to access the Lion MD provider portal.</p>
            <p>Click the button below to set your password and get started:</p>
            <a href="${inviteUrl}" style="display:inline-block; background:#1e40af; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; margin: 16px 0;">
              Set Up My Account
            </a>
            <p style="color:#666; font-size:0.85em;">This link expires in 7 days. If you have questions, reply to this email.</p>
          </div>
        `
      })
    })
  }

  return c.json({ success: true, invite_url: inviteUrl })
})

// ── POST /api/admin/users/bulk-portal-setup ───────────────────────────────────
admin.post('/users/bulk-portal-setup', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { contractors } = await c.req.json()
  if (!contractors?.length) return c.json({ error: 'No contractors provided' }, 400)

  const created = []
  for (const ct of contractors) {
    if (!ct.email) continue

    // Check if user already exists
    const existing = await c.env.DB.prepare('SELECT id FROM portal_users WHERE email = ?').bind(ct.email.toLowerCase()).first<any>()
    if (existing) continue

    const token = generateToken()
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const result = await c.env.DB.prepare(
      `INSERT INTO portal_users (email, name, role, contractor_id, invite_token, invite_token_expires, must_set_password, created_by)
       VALUES (?, ?, 'provider', ?, ?, ?, 1, ?) RETURNING id`
    ).bind(ct.email.toLowerCase(), ct.name || ct.email, ct.id || ct.contractor_id, token, expires, user.id).first<any>()

    created.push({ id: result.id, email: ct.email, invite_token: token })
  }

  return c.json({ created, count: created.length })
})

// ── GET /api/client-payments/clients ─────────────────────────────────────────
admin.get('/client-payments/clients', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare('SELECT * FROM cp_clients WHERE is_active = 1 ORDER BY name').all<any>()
  return c.json(rows.results)
})

// ── POST /api/client-payments/clients ─────────────────────────────────────────
admin.post('/client-payments/clients', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { name, notes } = await c.req.json()
  if (!name) return c.json({ error: 'Name required' }, 400)

  const result = await c.env.DB.prepare(
    'INSERT INTO cp_clients (name, notes) VALUES (?, ?) RETURNING id'
  ).bind(name, notes || '').first<any>()

  return c.json({ id: result.id }, 201)
})

// ── GET /api/client-payments/summary ─────────────────────────────────────────
admin.get('/client-payments/summary', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const byPeriod = await c.env.DB.prepare(
    `SELECT period_key, COUNT(*) as client_count,
       SUM(CASE WHEN amount IS NOT NULL THEN amount ELSE 0 END) as total_amount,
       SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
       SUM(CASE WHEN status = 'past_due' THEN 1 ELSE 0 END) as past_due_count,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
     FROM cp_payment_entries
     GROUP BY period_key
     ORDER BY period_key DESC`
  ).all<any>()

  const byClient = await c.env.DB.prepare(
    `SELECT cl.id, cl.name, cl.is_active,
       COUNT(e.id) as entry_count,
       SUM(CASE WHEN e.amount IS NOT NULL THEN e.amount ELSE 0 END) as total_received,
       MAX(e.period_key) as last_period
     FROM cp_clients cl
     LEFT JOIN cp_payment_entries e ON cl.id = e.client_id
     GROUP BY cl.id, cl.name, cl.is_active
     ORDER BY cl.name`
  ).all<any>()

  return c.json({ byPeriod: byPeriod.results, byClient: byClient.results })
})

// ── GET /api/client-payments/entries ─────────────────────────────────────────
admin.get('/client-payments/entries', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const period = c.req.query('period')
  let query = `SELECT e.*, cl.name as client_name FROM cp_payment_entries e
    JOIN cp_clients cl ON e.client_id = cl.id`
  const bindings: any[] = []
  if (period) { query += ' WHERE e.period_key = ?'; bindings.push(period) }
  query += ' ORDER BY cl.name'

  const rows = await c.env.DB.prepare(query).bind(...bindings).all<any>()
  return c.json(rows.results)
})

// ── POST /api/client-payments/entries ─────────────────────────────────────────
admin.post('/client-payments/entries', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { client_id, period_key, amount, status, notes } = await c.req.json()
  if (!client_id || !period_key) return c.json({ error: 'client_id and period_key required' }, 400)

  await c.env.DB.prepare(
    `INSERT INTO cp_payment_entries (client_id, period_key, amount, status, notes)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(client_id, period_key) DO UPDATE SET
       amount = excluded.amount,
       status = excluded.status,
       notes = excluded.notes,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(client_id, period_key, amount ?? null, status || 'pending', notes || '').run()

  return c.json({ success: true }, 201)
})

// ── PUT /api/client-payments/entries/:id ──────────────────────────────────────
admin.put('/client-payments/entries/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { amount, status, notes } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE cp_payment_entries SET amount = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(amount ?? null, status || 'pending', notes || '', c.req.param('id')).run()
  return c.json({ success: true })
})

// ── POST /api/client-payments/seed ────────────────────────────────────────────
admin.post('/client-payments/seed', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  // Get all periods and clients, seed missing entries
  const clients = await c.env.DB.prepare('SELECT id FROM cp_clients WHERE is_active = 1').all<any>()
  const periods = await c.env.DB.prepare('SELECT DISTINCT period_key FROM upload_sessions ORDER BY period_key DESC LIMIT 12').all<any>()

  const stmts = []
  for (const client of clients.results) {
    for (const period of periods.results) {
      stmts.push(c.env.DB.prepare(
        `INSERT OR IGNORE INTO cp_payment_entries (client_id, period_key, status) VALUES (?, ?, 'pending')`
      ).bind(client.id, period.period_key))
    }
  }

  if (stmts.length) await c.env.DB.batch(stmts)
  return c.json({ success: true, seeded: stmts.length })
})

export default admin
