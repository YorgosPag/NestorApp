#!/usr/bin/env node
'use strict';
/**
 * Γεννήτορας του `contracts/capture-api/` (ADR-904 Ε6 · CHECK 3.98) — το συμβόλαιο της εφαρμογής λήψης κινητού.
 *
 * Πρότυπο Kubernetes `update-codegen` / `verify-codegen`: αυτό είναι το «update», η πύλη
 * `scripts/check-capture-api-contract.js` το «verify». Αρνείται να γράψει οτιδήποτε αν το σχέδιο έχει σφάλμα.
 *
 * CLI: node scripts/generate-capture-api-contract.js
 */

const path = require('node:path');

const { applyJudgement, judgeOutputs } = require('./lib/generated-artifacts');
const { buildPlan } = require('./lib/capture-api-contract/plan');

function generate(root) {
  const plan = buildPlan(root);
  if (plan.errors.length > 0) return { ok: false, errors: plan.errors, written: [], removed: [] };
  const { results } = judgeOutputs(root, plan.outputs, plan.outputRoot);
  const { written, removed } = applyJudgement(root, plan.outputs, results);
  return { ok: true, errors: [], written, removed, total: plan.outputs.length };
}

function main() {
  const root = process.env.CAPTURE_API_CONTRACT_ROOT || path.resolve(__dirname, '..');
  const res = generate(root);
  if (!res.ok) {
    console.error('❌ capture API contract — το σχέδιο δεν χτίζεται, τίποτα δεν γράφτηκε:');
    for (const e of res.errors) console.error(`   • ${e}`);
    process.exit(1);
  }
  for (const p of res.written) console.log(`   ✍️  ${p}`);
  for (const p of res.removed) console.log(`   🗑️  ${p}`);
  console.log(`✅ capture API contract — ${res.total} files, ${res.written.length} written, ${res.removed.length} removed`);
}

if (require.main === module) main();

module.exports = { generate };
