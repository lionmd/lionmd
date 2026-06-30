/**
 * scripts/obfuscate-html.mjs
 *
 * Post-build step:
 *   1. Reads  dist/static/app.js  (copied from public/static/app.js by Vite)
 *   2. Minifies it with terser    → removes whitespace, shortens identifiers
 *   3. Obfuscates with javascript-obfuscator → encodes strings, mangles names
 *   4. Renames to app.<hash>.js   → busts Cloudflare CDN cache on every deploy
 *   5. Updates dist/index.html    → points <script src> at the new hashed filename
 *
 * Run automatically via `npm run build` (package.json build script).
 */

import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { resolve, dirname }                         from 'path'
import { fileURLToPath }                            from 'url'
import { createHash }                               from 'crypto'
import { minify }                                   from 'terser'
import JavaScriptObfuscator                         from 'javascript-obfuscator'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const distDir    = resolve(__dirname, '../dist')
const appJsPath  = resolve(distDir, 'static/app.js')
const indexPath  = resolve(distDir, 'index.html')

console.log('[build] Reading dist/static/app.js …')
const originalCode = readFileSync(appJsPath, 'utf8')
const origKB       = (originalCode.length / 1024).toFixed(0)

// ── Step 1: Minify with terser ─────────────────────────────────────────────
console.log('[build] Minifying with terser …')
const terserResult = await minify(originalCode, {
  compress: {
    drop_console:   false,
    passes:         2,
  },
  mangle: {
    toplevel: false,   // keep top-level names (called from onclick= attributes)
  },
  format: {
    comments: false,
  },
})

if (terserResult.error) {
  console.error('[build] terser error:', terserResult.error)
  process.exit(1)
}

const minifiedCode = terserResult.code
const minKB        = (minifiedCode.length / 1024).toFixed(0)
console.log(`[build] Minified: ${origKB} KB → ${minKB} KB`)

// ── Step 2: Obfuscate ─────────────────────────────────────────────────────
console.log('[build] Obfuscating …')
const OBF_OPTIONS = {
  compact:                    true,
  identifierNamesGenerator:  'mangled',
  renameGlobals:              false,
  renameProperties:           false,
  shuffleStringArray:         true,
  rotateStringArray:          true,
  stringArray:                true,
  stringArrayEncoding:        ['base64'],
  stringArrayThreshold:       0.75,
  splitStrings:               false,
  deadCodeInjection:          false,
  controlFlowFlattening:      false,
  selfDefending:              false,
  disableConsoleOutput:       false,
  sourceMap:                  false,
  debugProtection:            false,
  transformObjectKeys:        false,
}

let obfCode
try {
  const result = JavaScriptObfuscator.obfuscate(minifiedCode, OBF_OPTIONS)
  obfCode = result.getObfuscatedCode()
} catch (err) {
  console.error('[build] Obfuscator error:', err.message)
  process.exit(1)
}

const obfKB = (obfCode.length / 1024).toFixed(0)

// ── Step 3: Syntax-check ──────────────────────────────────────────────────
try {
  new Function(obfCode)
  console.log('[build] Syntax check: ✅ OK')
} catch (e) {
  console.error('[build] ❌ Syntax error in obfuscated output:', e.message)
  process.exit(1)
}

// ── Step 4: Write hashed filename → busts Cloudflare CDN cache ───────────
// Hash is derived from the final obfuscated content, so it only changes
// when the code actually changes.
const hash        = createHash('md5').update(obfCode).digest('hex').slice(0, 8)
const hashedName  = `app.${hash}.js`
const hashedPath  = resolve(distDir, 'static', hashedName)

// Remove the old unhashed file, write the new hashed one
unlinkSync(appJsPath)
writeFileSync(hashedPath, obfCode, 'utf8')
console.log(`[build] Written: dist/static/${hashedName}`)

// ── Step 5: Patch index.html to reference the hashed filename ────────────
let indexHtml = readFileSync(indexPath, 'utf8')
// Replace any existing app[.hash].js reference
indexHtml = indexHtml.replace(/\/static\/app(\.[a-f0-9]+)?\.js/, `/static/${hashedName}`)
writeFileSync(indexPath, indexHtml, 'utf8')
console.log(`[build] index.html updated → /static/${hashedName}`)

console.log(`[build] Done. app.js: ${origKB} KB → ${minKB} KB (minified) → ${obfKB} KB (obfuscated)`)
