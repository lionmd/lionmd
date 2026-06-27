/**
 * scripts/obfuscate-html.mjs
 *
 * Post-build step:
 *   1. Reads  dist/static/app.js  (copied from public/static/app.js by Vite)
 *   2. Minifies it with terser    → removes whitespace, shortens identifiers
 *   3. Obfuscates with javascript-obfuscator → encodes strings, mangles names
 *   4. Writes the result back to  dist/static/app.js
 *
 * Run automatically via `npm run build` (package.json build script).
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname }            from 'path'
import { fileURLToPath }               from 'url'
import { minify }                      from 'terser'
import JavaScriptObfuscator            from 'javascript-obfuscator'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appJsPath = resolve(__dirname, '../dist/static/app.js')

console.log('[build] Reading dist/static/app.js …')
const originalCode = readFileSync(appJsPath, 'utf8')
const origKB       = (originalCode.length / 1024).toFixed(0)

// ── Step 1: Minify with terser ─────────────────────────────────────────────
// Removes all whitespace, comments, shortens local variable names.
// Result: ~1 long line, unreadable but syntactically identical.
console.log('[build] Minifying with terser …')
const terserResult = await minify(originalCode, {
  compress: {
    drop_console:   false,   // keep console.error / console.warn
    passes:         2,       // two compression passes for better results
  },
  mangle: {
    toplevel: false,         // don't mangle top-level names (globals used by HTML)
  },
  format: {
    comments: false,         // strip all comments
  },
})

if (terserResult.error) {
  console.error('[build] terser error:', terserResult.error)
  process.exit(1)
}

const minifiedCode = terserResult.code
const minKB        = (minifiedCode.length / 1024).toFixed(0)
console.log(`[build] Minified: ${origKB} KB → ${minKB} KB`)

// ── Step 2: Obfuscate with javascript-obfuscator ───────────────────────────
// Encodes string literals to base64, shuffles the lookup array, mangles
// remaining identifiers.  Result: completely unreadable in DevTools.
console.log('[build] Obfuscating …')
const OBF_OPTIONS = {
  compact:                    true,
  identifierNamesGenerator:  'mangled',    // a, b, c …
  renameGlobals:              false,        // keep globals intact (DOM APIs etc.)
  renameProperties:           false,        // safer — dynamic key access intact
  shuffleStringArray:         true,
  rotateStringArray:          true,
  stringArray:                true,
  stringArrayEncoding:        ['base64'],   // string literals → base64
  stringArrayThreshold:       0.75,         // encode 75 % of strings
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

// ── Step 3: Syntax-check the final output ─────────────────────────────────
// Catches any corruption before it reaches users.
try {
  new Function(obfCode)
  console.log('[build] Syntax check: ✅ OK')
} catch (e) {
  console.error('[build] ❌ Syntax error in obfuscated output:', e.message)
  process.exit(1)
}

// ── Step 4: Write back ────────────────────────────────────────────────────
writeFileSync(appJsPath, obfCode, 'utf8')

console.log(`[build] Done. app.js: ${origKB} KB → ${minKB} KB (minified) → ${obfKB} KB (obfuscated)`)
