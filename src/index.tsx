import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import auth from './routes/auth'
import sessions from './routes/sessions'
import upload from './routes/upload'
import consults from './routes/consults'
import contractors from './routes/contractors'
import summary from './routes/summary'
import rates from './routes/rates'
import onboarding from './routes/onboarding'
import provider from './routes/provider'
import admin from './routes/admin'
import apply from './routes/apply'

export type Bindings = {
  DB: D1Database
  RESEND_API_KEY: string
  ASSETS: Fetcher
}

const app = new Hono<{ Bindings: Bindings }>()

// ── Global middleware ─────────────────────────────────────────────────────────
app.use('*', logger())
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Disposition'],
}))

// ── Auth routes  (/api/auth/*) ────────────────────────────────────────────────
// login, me, setup-password, invite/:token, forgot-password, change-password
app.route('/api/auth', auth)

// ── Session / period routes  (/api/sessions, /api/periods/*) ─────────────────
app.route('/api', sessions)

// ── Upload / recalculate / doctor-match routes ────────────────────────────────
// /api/upload, /api/upload/chunk, /api/recalculate, /api/doctors/match, /api/doctors/quick-add
app.route('/api', upload)

// ── Consult routes  (/api/consults/*, /api/consults/export) ──────────────────
app.route('/api', consults)

// ── Contractor routes  (/api/contractors/*, /api/admin/contractors/*,
//    /api/admin/licenses/*, /api/admin/contractor-documents/*) ─────────────────
app.route('/api', contractors)

// ── Summary / export routes  (/api/summary/*, /api/paystub/*,
//    /api/cv-summary/*, /api/commission/*, /api/export/*) ──────────────────────
app.route('/api', summary)

// ── Rate routes  (/api/rates, /api/contractor-type-rates) ────────────────────
app.route('/api', rates)

// ── Onboarding routes  (/api/onboarding/*) ───────────────────────────────────
app.route('/api/onboarding', onboarding)

// ── Provider portal routes  (/api/provider/*) ────────────────────────────────
app.route('/api/provider', provider)

// ── Admin routes  (/api/admin/users/*, /api/client-payments/*,
//    /api/admin/send-invite-email) ──────────────────────────────────────────────
app.route('/api/admin', admin)

// ── Public apply + candidate status  (/api/apply, /api/candidate/status) ─────
app.route('/api', apply)

// ── Catch-all: forward everything else to ASSETS (SPA + static files) ────────
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
