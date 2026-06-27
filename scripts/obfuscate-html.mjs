/**
 * scripts/obfuscate-html.mjs
 *
 * Post-build step: extracts every <script>…</script> block from
 * dist/index.html, obfuscates the JavaScript with javascript-obfuscator,
 * and writes the result back in place.
 *
 * Run automatically via `npm run build` (see package.json "postbuild" hook).
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import JavaScriptObfuscator from 'javascript-obfuscator'

const __dirname = dirname(fileURLToPath(import.meta.url))
const htmlPath  = resolve(__dirname, '../dist/index.html')

console.log('[obfuscate] Reading dist/index.html …')
let html = readFileSync(htmlPath, 'utf8')

// ── Obfuscation options ────────────────────────────────────────────────────
// Tuned for balance between protection strength and runtime performance.
// Cloudflare Pages serves static files, so size increase is acceptable.
const OBF_OPTIONS = {
  // Rename local variables/functions to short random names
  compact:                          true,
  identifierNamesGenerator:        'mangled',   // short: a, b, c …
  renameGlobals:                    false,       // keep global names intact (DOM APIs, etc.)
  renameProperties:                 false,       // safer — avoid breaking object keys
  shuffleStringArray:               true,
  rotateStringArray:                true,
  stringArray:                      true,
  stringArrayEncoding:              ['base64'],  // string literals become base64
  stringArrayThreshold:             0.75,        // encode 75 % of strings
  splitStrings:                     false,       // skip — too slow at runtime for large files
  deadCodeInjection:                false,       // skip — balloons file size
  controlFlowFlattening:            false,       // skip — significant perf cost
  selfDefending:                    false,       // skip — breaks in some CSP contexts
  disableConsoleOutput:             false,       // keep console for error reporting
  sourceMap:                        false,       // never emit source maps
  debugProtection:                  false,       // skip — breaks legitimate debugging flows
  transformObjectKeys:              false,       // skip — too risky with dynamic key access
}

// ── Extract and obfuscate inline <script> blocks ───────────────────────────
// We skip:
//   • external scripts (src="…") — CDN libraries, not our code
//   • type="application/json" etc. — data blocks
//   • very short snippets (< 200 chars) — likely harmless inline oneliners
const SCRIPT_RE = /<script(?![^>]*\bsrc\b)(?![^>]*type=["'](?!text\/javascript)[^"']+["'])[^>]*>([\s\S]*?)<\/script>/gi

let scriptCount = 0
let totalOrigBytes = 0
let totalObfBytes  = 0

html = html.replace(SCRIPT_RE, (fullMatch, jsCode, offset, _str, namedGroups, ...rest) => {
  const trimmed = jsCode.trim()
  if (trimmed.length < 200) return fullMatch   // skip trivial snippets

  scriptCount++
  totalOrigBytes += trimmed.length

  try {
    const result = JavaScriptObfuscator.obfuscate(trimmed, OBF_OPTIONS)
    const obfCode = result.getObfuscatedCode()
    totalObfBytes += obfCode.length

    // Extract the opening tag (everything before the JS body starts)
    // and closing tag, then reconstruct manually.
    // IMPORTANT: do NOT use String.replace() here — obfuscated code contains
    // `$` characters that String.replace() interprets as special replacement
    // patterns ($&, $1, $$, etc.), corrupting the output.
    const openTag  = fullMatch.slice(0, fullMatch.indexOf(jsCode))
    const closeTag = '</script>'
    return openTag + obfCode + closeTag
  } catch (err) {
    console.warn(`[obfuscate] Warning: could not obfuscate script block #${scriptCount}:`, err.message)
    return fullMatch   // leave original on error
  }
})

writeFileSync(htmlPath, html, 'utf8')

const pct = totalOrigBytes > 0
  ? ((totalObfBytes - totalOrigBytes) / totalOrigBytes * 100).toFixed(1)
  : '0'

console.log(`[obfuscate] Done. ${scriptCount} script block(s) obfuscated.`)
console.log(`[obfuscate] Size: ${(totalOrigBytes/1024).toFixed(0)} KB → ${(totalObfBytes/1024).toFixed(0)} KB (${pct > 0 ? '+' : ''}${pct}%)`)
