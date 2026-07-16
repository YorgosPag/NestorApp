#!/usr/bin/env node
/**
 * =============================================================================
 * SSoT FLAT REGISTRY GENERATOR (ADR-294)
 * =============================================================================
 *
 * Renders `.ssot-registry.json` → `.ssot-registry-flat.txt`.
 *
 * WHY THIS EXISTS: the flat file is what the ratchet actually reads —
 * `scripts/check-ssot-imports.{js,sh}` (CHECK 3.7, the pre-commit gate) and
 * `scripts/ssot-audit.sh` all parse it, never the JSON. Yet nothing regenerated
 * it: `ssot-audit.sh` rebuilds it only `if [[ ! -f ]]`, and the script it calls
 * (`generate-ssot-baseline.sh` → `ssot-baseline-engine.js`) writes the
 * *baseline*, not the flat file. So the flat file drifted by hand, and every
 * pattern added to the JSON after its last manual refresh was **dormant** —
 * present in the registry, green in the golden tests, and never executed.
 *
 * Found 2026-07-16: the flat file was 3 days stale and the new `openai-provider`
 * raw-fetch pattern was silently enforcing nothing. Same failure class as the
 * v3.0 `(?:...)`-matches-nothing bug and the dormant `gcs-buckets` ratchet — an
 * enforcement tool that reads a derived artifact fails open, quietly.
 *
 * Run after ANY edit to `.ssot-registry.json`:
 *   npm run ssot:flat
 *
 * Verify without writing (CI / pre-commit):
 *   npm run ssot:flat -- --check   → exit 1 if the flat file is out of date
 *
 * @see ADR-294 — SSoT Ratchet Enforcement
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT, '.ssot-registry.json');
const FLAT_FILE = path.join(ROOT, '.ssot-registry-flat.txt');

/**
 * Render the registry to the flat format the ratchet parsers expect.
 *
 * Line grammar (see `parseFlatRegistry` in scripts/check-ssot-imports.js):
 *   EXEMPT:<regex>   — once, first line
 *   MODULE:<name>    — opens a module block
 *   SSOT:<path>      — informational; parsers skip it
 *   PATTERN:<regex>  — zero or more
 *   ALLOW:<path>     — zero or more
 *
 * `_comment_*` keys are emitted as bare MODULE lines with no PATTERN, which
 * compile to a null matcher — harmless, and preserved so the file round-trips.
 *
 * @param {{exemptPatterns: string, modules: Record<string, object>}} registry
 * @returns {string}
 */
function renderFlatRegistry(registry) {
  const lines = [`EXEMPT:${registry.exemptPatterns}`];

  for (const [name, mod] of Object.entries(registry.modules)) {
    lines.push(`MODULE:${name}`);
    if (!mod || typeof mod !== 'object') continue;

    if (mod.ssotFile) lines.push(`SSOT:${mod.ssotFile}`);
    for (const pattern of mod.forbiddenPatterns || []) lines.push(`PATTERN:${pattern}`);
    for (const allowed of mod.allowlist || []) lines.push(`ALLOW:${allowed}`);
  }

  return lines.join('\n') + '\n';
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  const rendered = renderFlatRegistry(registry);

  const current = fs.existsSync(FLAT_FILE) ? fs.readFileSync(FLAT_FILE, 'utf8') : null;

  if (current === rendered) {
    console.log('✅ .ssot-registry-flat.txt is up to date.');
    return;
  }

  if (checkOnly) {
    console.error('❌ .ssot-registry-flat.txt is STALE — the ratchet is not enforcing the registry.');
    console.error('   Run: npm run ssot:flat');
    process.exit(1);
  }

  fs.writeFileSync(FLAT_FILE, rendered);
  const moduleCount = Object.keys(registry.modules).length;
  const patternCount = Object.values(registry.modules)
    .reduce((n, m) => n + ((m && m.forbiddenPatterns) || []).length, 0);
  console.log(`✅ Wrote .ssot-registry-flat.txt — ${moduleCount} modules, ${patternCount} patterns.`);
}

if (require.main === module) {
  main();
}

module.exports = { renderFlatRegistry, REGISTRY_FILE, FLAT_FILE };
