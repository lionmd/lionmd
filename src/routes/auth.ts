import { Hono } from 'hono'

const auth = new Hono<{ Bindings: { DB: D1Database; RESEND_API_KEY: string } }>()

// ── Helpers ──────────────────────────────────────────────────────────────────

// Password format stored in DB: "pbkdf2:{hex_salt}:{hex_hash}"
// Algorithm: PBKDF2-HMAC-SHA256, 100,000 iterations, 16-byte salt, 32-byte key
const PBKDF2_ITERATIONS = 100_000
const SALT_BYTES = 16
const KEY_BYTES = 32

function buf2hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hex2buf(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return arr
}

async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES)
  crypto.getRandomValues(salt)
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial, KEY_BYTES * 8
  )
  return `pbkdf2:${buf2hex(salt.buffer)}:${buf2hex(derived)}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Support legacy plain SHA-256 base64 hashes (pre-migration)
  if (!stored.startsWith('pbkdf2:')) {
    const encoder = new TextEncoder()
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(password))
    return btoa(String.fromCharCode(...new Uint8Array(hash))) === stored
  }
  const parts = stored.split(':')
  if (parts.length !== 3) return false
  const [, saltHex, hashHex] = parts
  const salt = hex2buf(saltHex)
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial, KEY_BYTES * 8
  )
  return buf2hex(derived) === hashHex
}

async function generateToken(userId: number, email: string, name: string, role: string): Promise<string> {
  // Token format: base64(JSON payload).hex(SHA-256 sig) — matches reference backend
  const payload = btoa(JSON.stringify({ id: userId, email, name, role, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }))
  const sigBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
  return `${payload}.${buf2hex(sigBuf)}`
}

function generateInviteToken(): string {
  const arr = new Uint8Array(24)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function parseToken(token: string): { id: number; role: string; exp: number } | null {
  try {
    // Format: "base64payload.hexsig" — strip the sig part before decoding
    const payload = token.includes('.') ? token.split('.')[0] : token
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

export async function requireAuth(
  db: D1Database,
  authHeader: string | null
): Promise<{ id: number; role: string; name: string; email: string; contractor_id: number | null } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const parsed = parseToken(token)
  if (!parsed || parsed.exp < Date.now()) return null
  const user = await db.prepare(
    'SELECT id, email, name, role, is_active, contractor_id FROM portal_users WHERE id = ?'
  ).bind(parsed.id).first<any>()
  if (!user || !user.is_active) return null
  return user
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
auth.post('/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

  const user = await c.env.DB.prepare(
    'SELECT * FROM portal_users WHERE email = ? AND is_active = 1'
  ).bind(email.toLowerCase().trim()).first<any>()

  if (!user) return c.json({ error: 'Invalid email or password' }, 401)

  // If no password set yet, check invite token flow
  if (!user.password_hash) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return c.json({ error: 'Invalid email or password' }, 401)

  if (user.must_set_password) {
    // Generate a fresh invite token for password setup
    const token = generateInviteToken()
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await c.env.DB.prepare(
      'UPDATE portal_users SET invite_token = ?, invite_token_expires = ? WHERE id = ?'
    ).bind(token, expires, user.id).run()
    return c.json({ must_set_password: true, invite_token: token })
  }

  await c.env.DB.prepare('UPDATE portal_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run()

  const token = await generateToken(user.id, user.email, user.name, user.role)
  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      contractor_id: user.contractor_id ?? null,
      phone: user.phone ?? ''
    }
  })
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
auth.get('/me', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  return c.json(user)
})

// ── POST /api/auth/setup-password ─────────────────────────────────────────────
auth.post('/setup-password', async (c) => {
  const { invite_token, password, confirm_password } = await c.req.json()
  if (!invite_token || !password) return c.json({ error: 'Missing fields' }, 400)
  if (password !== confirm_password) return c.json({ error: 'Passwords do not match' }, 400)
  if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400)

  const user = await c.env.DB.prepare(
    `SELECT * FROM portal_users WHERE invite_token = ? AND invite_token_expires > datetime('now') AND is_active = 1`
  ).bind(invite_token).first<any>()

  if (!user) return c.json({ error: 'Invalid or expired invite link' }, 400)

  const hash = await hashPassword(password)
  await c.env.DB.prepare(
    `UPDATE portal_users SET password_hash = ?, must_set_password = 0, invite_token = NULL, invite_token_expires = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(hash, user.id).run()

  await c.env.DB.prepare('UPDATE portal_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run()

  const token = await generateToken(user.id, user.email, user.name, user.role)
  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, contractor_id: user.contractor_id ?? null }
  })
})

// ── GET /api/auth/invite/:token ────────────────────────────────────────────────
auth.get('/invite/:token', async (c) => {
  const token = c.req.param('token')
  const user = await c.env.DB.prepare(
    `SELECT id, email, name, role FROM portal_users WHERE invite_token = ? AND invite_token_expires > datetime('now') AND is_active = 1`
  ).bind(token).first<any>()
  if (!user) return c.json({ error: 'Invalid or expired invite link' }, 400)
  return c.json({ valid: true, email: user.email, name: user.name })
})

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
auth.post('/forgot-password', async (c) => {
  const { email } = await c.req.json()
  if (!email) return c.json({ error: 'Email required' }, 400)

  const user = await c.env.DB.prepare(
    'SELECT * FROM portal_users WHERE email = ? AND is_active = 1'
  ).bind(email.toLowerCase().trim()).first<any>()

  // Always return success to prevent email enumeration
  if (!user) return c.json({ success: true })

  const token = generateInviteToken()
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await c.env.DB.prepare(
    'UPDATE portal_users SET invite_token = ?, invite_token_expires = ?, must_set_password = 1 WHERE id = ?'
  ).bind(token, expires, user.id).run()

  // Send email via Resend
  if (c.env.RESEND_API_KEY) {
    const resetUrl = `https://lionmd-payroll.pages.dev/login?invite=${token}`
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Lion MD <no-reply@lion.md>',
        to: user.email,
        subject: 'Reset your Lion MD password',
        html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 24 hours.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
      })
    })
  }

  return c.json({ success: true })
})

// ── POST /api/auth/change-password ────────────────────────────────────────────
auth.post('/change-password', async (c) => {
  const user = await requireAuth(c.env.DB, c.req.header('Authorization') ?? null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { old_password, new_password } = await c.req.json()
  if (!old_password || !new_password) return c.json({ error: 'Missing fields' }, 400)
  if (new_password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400)

  const dbUser = await c.env.DB.prepare('SELECT password_hash FROM portal_users WHERE id = ?').bind(user.id).first<any>()
  const valid = await verifyPassword(old_password, dbUser.password_hash)
  if (!valid) return c.json({ error: 'Current password is incorrect' }, 400)

  const hash = await hashPassword(new_password)
  await c.env.DB.prepare('UPDATE portal_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(hash, user.id).run()

  return c.json({ success: true })
})

export default auth
