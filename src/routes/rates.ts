import { Hono } from 'hono'
import { requireAuth } from './auth'

const rates = new Hono<{ Bindings: { DB: D1Database } }>()

// ── GET /api/rates ─────────────────────────────────────────────────────────────
rates.get('/', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare('SELECT * FROM payment_rates ORDER BY id').all<any>()
  return c.json(rows.results)
})

// ── PUT /api/rates/:id ─────────────────────────────────────────────────────────
rates.put('/:id', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { carevalidate_rate, contractor_rate, label } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE payment_rates SET carevalidate_rate = ?, contractor_rate = ?, label = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(carevalidate_rate, contractor_rate, label, c.req.param('id')).run()
  return c.json({ success: true })
})

// ── GET /api/contractor-type-rates ────────────────────────────────────────────
rates.get('/contractor-type-rates', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await c.env.DB.prepare(
    'SELECT * FROM contractor_type_rates ORDER BY contractor_type, visit_type'
  ).all<any>()
  return c.json(rows.results)
})

// ── PUT /api/contractor-type-rates ────────────────────────────────────────────
rates.put('/contractor-type-rates', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const { contractor_type, visit_type, contractor_rate, label } = await c.req.json()
  if (!contractor_type || !visit_type) return c.json({ error: 'Missing fields' }, 400)

  await c.env.DB.prepare(
    `INSERT INTO contractor_type_rates (contractor_type, visit_type, contractor_rate, label)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(contractor_type, visit_type) DO UPDATE SET
       contractor_rate = excluded.contractor_rate,
       label = excluded.label,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(contractor_type, visit_type, contractor_rate ?? 0, label || visit_type).run()

  return c.json({ success: true })
})

export default rates
