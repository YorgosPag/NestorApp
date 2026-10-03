#!/usr/bin/env node
'use strict';
/**
 * Generator of `functions/src/generated/` (ADR-874 · CHECK 3.93).
 *
 * The Cloud Functions build is a separate npm unit that Firebase uploads on its
 * own (`firebase.json` → `source: functions`), so it cannot import `src/`. It
 * receives the app code it needs by PROJECTION: the manifest
 * `.functions-projection.json` names the portable modules (copied verbatim) and
 * the constant maps (key subset computed from the code). Kubernetes does the same
 * with `hack/update-codegen.sh` + `hack/verify-codegen.sh`; the verify half here
 * is `scripts/check-functions-projection.js`.
 *
 * Writes the plan, removes orphans, refuses on any plan error (nothing is written).
 *
 * CLI: node scripts/generate-functions-projection.js
 */

const path = require('node:path');

const { applyJudgement } = require('./lib/generated-artifacts');
const { judge } = require('./lib/functions-projection/judge');

function generate(root) {
  const { results, plan } = judge(root);
  if (plan.errors.length > 0) return { ok: false, errors: plan.errors, written: [], removed: [] };
  const { written, removed } = applyJudgement(root, plan.outputs, results);
  return { ok: true, errors: [], written, removed, total: plan.outputs.length };
}

function main() {
  const root = process.env.FUNCTIONS_PROJECTION_ROOT || path.resolve(__dirname, '..');
  const res = generate(root);
  if (!res.ok) {
    console.error('❌ functions projection — cannot build the plan, nothing written:');
    for (const e of res.errors) console.error(`   • ${e}`);
    process.exit(1);
  }
  for (const p of res.written) console.log(`   ✍️  ${p}`);
  for (const p of res.removed) console.log(`   🗑️  ${p}`);
  console.log(`✅ functions projection — ${res.total} files, ${res.written.length} written, ${res.removed.length} removed`);
}

if (require.main === module) main();

module.exports = { generate };
