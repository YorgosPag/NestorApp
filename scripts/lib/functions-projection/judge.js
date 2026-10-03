'use strict';
/**
 * CHECK 3.93 (ADR-874) — the disk against the plan. Freshness is binary: there is
 * no baseline, no tolerated count, ever (same doctrine as CHECK 3.33/3.34).
 *
 * States + line-ending doctrine: `scripts/lib/generated-artifacts.js` (shared with CHECK 3.98).
 */

const { STATES, judgeOutputs, listGenerated } = require('../generated-artifacts');

const { buildPlan } = require('./plan');

/** @returns {{ ok: boolean, results: Array<{path:string, state:string, detail?:string}>, plan: object }} */
function judge(root) {
  const plan = buildPlan(root);
  if (plan.errors.length > 0) {
    const results = plan.errors.map((detail) => ({ path: '.functions-projection.json', state: STATES.INVALID, detail }));
    return { ok: false, results, plan };
  }
  const { ok, results } = judgeOutputs(root, plan.outputs, plan.manifest.outputRoot);
  return { ok, results, plan };
}

module.exports = { judge, listGenerated, STATES };
