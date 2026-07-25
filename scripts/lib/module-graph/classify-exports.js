#!/usr/bin/env node
/**
 * ADR-700 §1 — Five-bucket verdict for every declared export.
 *
 *   live         — reachable from a real root and imported by name.
 *   testOnly     — reachable only once test files are seeded as roots.
 *                  Reported, NEVER ratcheted: deleting a symbol because "only
 *                  its test uses it" removes the contract, not the caller.
 *   suspect      — unreachable, but its identifier still appears in real code
 *                  inside a LIVE module. String registries, indirection, or a
 *                  bug in this very tool all land here. A human decides.
 *   unusedExport — unreachable from outside, alive inside its own file. The
 *                  `export` keyword is redundant; the code is not dead.
 *   dead         — unreachable, and its name appears in no live module. The
 *                  only bucket the ratchet counts, and the only one a human may
 *                  act on — with manual proof, one file at a time.
 */

'use strict';

const { usageKey, occursInLiveModule } = require('./build-graph');

const BUCKETS = ['dead', 'unusedExport', 'suspect', 'testOnly', 'live'];
const UNREACHABLE_BUCKETS = new Set(['dead', 'unusedExport']);

function classifyExport(graph, live, test, mod, exp) {
  const key = usageKey(mod.file, exp.name);
  if (live.liveSymbols.has(key)) return 'live';
  if (test.liveSymbols.has(key)) return 'testOnly';
  // Look for the symbol's WRITTEN name: `export default function Foo` is
  // exported as "default", and searching the tree for the token "default"
  // would match half of it.
  const token = exp.localName || exp.name;
  if (token !== 'default' &&
      occursInLiveModule(graph.identifierOwners, token, mod.file, live.liveModules)) {
    return 'suspect';
  }
  // "Redundant export" is only a meaningful verdict for a module something
  // actually reaches. In an unreachable module the local use is one dead line
  // calling another — that is dead code, not an over-wide export.
  const moduleReachable = live.liveModules.has(mod.file);
  return moduleReachable && exp.localUses > 1 ? 'unusedExport' : 'dead';
}

function localExportsOf(mod) {
  return mod.exports.filter(e => e.origin === 'local');
}

/**
 * A file is dead when nothing live reaches it and every symbol it declares is
 * unreachable. `unusedExport` counts here: a symbol used only by its own file
 * cannot keep that file alive if no import ever arrives.
 */
function classifyFile(live, mod, verdicts) {
  if (live.liveModules.has(mod.file) || live.sideEffect.has(mod.file)) return false;
  return verdicts.every(v => UNREACHABLE_BUCKETS.has(v.bucket));
}

function emptyResult() {
  const result = { deadFiles: [], scanned: 0 };
  for (const bucket of BUCKETS) result[bucket] = [];
  return result;
}

function classifyExports(graph, live, test, { inScope }) {
  const result = emptyResult();

  for (const mod of graph.modules.values()) {
    if (!inScope(mod.file)) continue;
    result.scanned += 1;

    const verdicts = localExportsOf(mod).map(exp => ({
      file: mod.file,
      name: exp.name,
      line: exp.line,
      bucket: classifyExport(graph, live, test, mod, exp),
    }));

    for (const v of verdicts) result[v.bucket].push(v);
    if (classifyFile(live, mod, verdicts)) result.deadFiles.push(mod.file);
  }

  for (const bucket of BUCKETS) {
    result[bucket].sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
  }
  result.deadFiles.sort();
  return result;
}

module.exports = { BUCKETS, UNREACHABLE_BUCKETS, classifyExport, localExportsOf, classifyFile, classifyExports };
