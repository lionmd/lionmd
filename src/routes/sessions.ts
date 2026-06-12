import { Hono } from 'hono'
import { requireAuth } from './auth'

const sessions = new Hono<{ Bindings: { DB: D1Database } }>()

// ── GET /api/sessions ─────────────────────────────────────────────────────────
sessions.get('/', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    `SELECT id, period_key, period_label, period_month, period_year, total_cases,
            total_carevalidate_amount, total_contractor_amount, status, uploaded_at, notes, source_label
     FROM upload_sessions
     ORDER BY period_year DESC, period_month DESC, uploaded_at DESC`
  ).all<any>()

  return c.json(rows.results)
})

// ── DELETE /api/sessions/:id ──────────────────────────────────────────────────
sessions.delete('/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM upload_sessions WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ── GET /api/periods/:periodKey ────────────────────────────────────────────────
sessions.get('/periods/:periodKey', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const pk = c.req.param('periodKey')
  const session = await c.env.DB.prepare(
    'SELECT * FROM upload_sessions WHERE period_key = ? ORDER BY uploaded_at DESC LIMIT 1'
  ).bind(pk).first<any>()
  if (!session) return c.json({ error: 'Period not found' }, 404)

  const settings = await c.env.DB.prepare(
    'SELECT denied_paid FROM period_settings WHERE period_key = ?'
  ).bind(pk).first<any>()

  return c.json({ ...session, denied_paid: settings?.denied_paid ?? 0 })
})

// ── DELETE /api/periods/:periodKey ─────────────────────────────────────────────
sessions.delete('/periods/:periodKey', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const pk = c.req.param('periodKey')
  // Delete all sessions (and cascading consults) for this period
  await c.env.DB.prepare('DELETE FROM upload_sessions WHERE period_key = ?').bind(pk).run()
  await c.env.DB.prepare('DELETE FROM period_settings WHERE period_key = ?').bind(pk).run()
  return c.json({ success: true })
})

export default sessions
