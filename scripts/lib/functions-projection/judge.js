'use strict';
/**
 * CHECK 3.93 (ADR-874) — the disk against the plan. Freshness is binary: there is
 * no baseline, no tolerated count, ever (same doctrine as CHECK 3.33/3.34).
 *
 * States:
 *   fresh    — the generated file equals the plan
 *   stale    — it differs: the SSoT moved without a regeneration, OR someone
 *              edited the generated file by hand (both are the same failure)
 *   missing  — the plan has it, the disk does not
 *   orphan   — the disk has it, the plan does not (a removed projection whose
 *              file lingers would keep compiling into the functions build)
 *   invalid  — the plan itself cannot be built (closure / key / manifest error)
 *
 * Line endings are normalized on BOTH sides: `core.autocrlf=true` and no
 * `.gitattributes` mean the working tree may hold CRLF (lesson of CHECK 3.33).
 */

const fs = require('node:fs');
const path = require('node:path');

const { buildPlan, readLf } = require('./plan');

const STATES = { FRESH: 'fresh', STALE: 'stale', MISSING: 'missing', ORPHAN: 'orphan', INVALID: 'invalid' };

function listGenerated(root, outputRoot) {
  const base = path.join(root, outputRoot);
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(abs);
      else out.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  };
  walk(base);
  return out;
}

function stateOf(root, output) {
  const abs = path.join(root, output.path);
  if (!fs.existsSync(abs)) return STATES.MISSING;
  return readLf(abs) === output.content ? STATES.FRESH : STATES.STALE;
}

/** @returns {{ ok: boolean, results: Array<{path:string, state:string, detail?:string}>, plan: object }} */
function judge(root) {
  const plan = buildPlan(root);
  if (plan.errors.length > 0) {
    const results = plan.errors.map((detail) => ({ path: '.functions-projection.json', state: STATES.INVALID, detail }));
    return { ok: false, results, plan };
  }
  const planned = new Set(plan.outputs.map((o) => o.path));
  const results = plan.outputs.map((o) => ({ path: o.path, state: stateOf(root, o) }));
  for (const file of listGenerated(root, plan.manifest.outputRoot)) {
    if (!planned.has(file)) results.push({ path: file, state: STATES.ORPHAN });
  }
  return { ok: results.every((r) => r.state === STATES.FRESH), results, plan };
}

module.exports = { judge, listGenerated, STATES };
