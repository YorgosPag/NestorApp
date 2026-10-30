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

const { generateArtifacts, reportGeneration, judgeOutputs } = require('./lib/generated-artifacts');
const { buildPlan } = require('./lib/capture-api-contract/plan');
const { commitInput } = require('./lib/gate-input');

/**
 * `input` (ADR-924 Φ5): με `--index` ο γεννήτορας εκτελεί το συμβόλαιο ΤΟΥ COMMIT — ό,τι θα κρίνει η 3.98 — και
 * ξαναγράφει μόνο όσα αποκλίνουν από αυτό. Η εγγραφή: δίσκος.
 */
function generate(root, input = commitInput(root)) {
  return generateArtifacts(root, (view) => {
    const plan = buildPlan(root, view);
    return { plan, results: plan.errors.length > 0 ? [] : judgeOutputs(root, plan.outputs, plan.outputRoot, view).results };
  }, input);
}

function main() {
  const root = process.env.CAPTURE_API_CONTRACT_ROOT || path.resolve(__dirname, '..');
  process.exitCode = reportGeneration(generate(root), {
    label: 'capture API contract', failure: 'το σχέδιο δεν χτίζεται, τίποτα δεν γράφτηκε:',
  });
}

if (require.main === module) main();

module.exports = { generate };
