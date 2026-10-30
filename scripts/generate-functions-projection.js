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

const { generateArtifacts, reportGeneration } = require('./lib/generated-artifacts');
const { judge } = require('./lib/functions-projection/judge');
const { commitInput } = require('./lib/gate-input');

/**
 * `input` (ADR-924 Φ5): με `--index` ο γεννήτορας παράγει από την ΟΨΗ ΤΟΥ COMMIT — ό,τι θα κρίνει η 3.93 — και ξαναγράφει
 * μόνο όσα αποκλίνουν από αυτήν (ξένη αστάδιοποίητη αλλαγή στις εισόδους δεν μπαίνει στα παραγόμενα). Η εγγραφή: δίσκος.
 */
function generate(root, input = commitInput(root)) {
  return generateArtifacts(root, (view) => judge(root, view), input);
}

function main() {
  const root = process.env.FUNCTIONS_PROJECTION_ROOT || path.resolve(__dirname, '..');
  process.exitCode = reportGeneration(generate(root), {
    label: 'functions projection', failure: 'cannot build the plan, nothing written:',
  });
}

if (require.main === module) main();

module.exports = { generate };
