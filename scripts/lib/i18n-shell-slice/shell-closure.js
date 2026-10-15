#!/usr/bin/env node
/**
 * ADR-744 §1 — "what can paint in the first frame?"
 *
 * The shell is the set of modules that reach the screen through the INITIAL
 * JavaScript chunk: the static import closure of the root layout. Everything
 * else arrives behind a boundary that carries its own loading state.
 *
 * THREE MEASUREMENTS THAT DEFINE THIS FILE (2026-07-31, on the real tree)
 * ----------------------------------------------------------------------
 *   naive BFS, following every re-export        → 7.901 files / 68 namespaces
 *   ADR-700 `computeLiveness` from layout.tsx   → 7.492 files / 67 namespaces
 *   static-only, barrel-aware (this file)       →   343 files / 15 namespaces
 *
 * The first number is why "just walk the imports" does not produce a shell — it
 * produces the application. The gap between the second and the third is almost
 * entirely `next/dynamic`: `ConditionalAppShell` reaches `BuildingsPageContent`,
 * `GlobalSearchDialog`, `FloorplanImportWizard` and 15 more through
 * `dynamic(() => import(...))`, and each one drags its whole subtree in.
 *
 * WHY A DYNAMIC IMPORT IS A BOUNDARY — and why that is the opposite call from ADR-700
 * ----------------------------------------------------------------------------------
 * ADR-700 asks "is this symbol dead?" and resolves every ambiguity toward LIVE,
 * so it follows `import()` edges. This module asks a different question — "can
 * this module paint before the async i18n preload resolves?" — and a module in a
 * lazily-fetched chunk cannot paint until its own network round-trip completes,
 * which is the same boundary the loading state already covers.
 *
 * That is a deliberate, measured trade-off, not an oversight: following those
 * edges would put 2,93 MB of locale data back into the synchronous bootstrap and
 * defeat the entire point. `.i18n-shell-slice.json → extraShellRoots` exists to
 * force a specific dynamic subtree back in, should evidence ever appear.
 *
 * FAIL-SAFE DIRECTION
 * -------------------
 * Where ADR-700 must never invent a deletion, this walk must never invent an
 * ABSENCE: an unresolvable named import falls back to including the whole target
 * module, because a module wrongly left out of the shell is a raw key on screen,
 * while a module wrongly included is a few hundred bytes.
 */

'use strict';

const path = require('node:path');
const MG = require('../module-graph');
const { isEntryFile } = require('../module-graph/scan-config');

/** Next.js file conventions that own their own loading state. */
const ROUTE_BOUNDARY = /\/(page|loading|error|not-found|default|template|global-error)\.tsx?$/;

function relPosix(projectRoot, file) {
  // Γρήγορος δρόμος (ADR-744 §31): κάθε αρχείο του γράφου είναι `toPosix(join(root, rel))`, άρα το
  // πρόθεμα κόβεται· το `path.relative` σε ΚΑΘΕ ακμή μετρήθηκε ~25% ενός ζεστού περάσματος.
  const root = MG.toPosix(projectRoot);
  if (file.startsWith(`${root}/`)) return file.slice(root.length + 1);
  return MG.toPosix(path.relative(projectRoot, file));
}

const namesOf = (names, render) => (names && names.length > 0 ? ` {${names.map(render).sort().join(',')}}` : '');

/**
 * ADR-744 §31 — **ό,τι ΔΙΑΒΑΖΕΙ ο walk από αυτό το αρχείο**, ως ταξινομημένες γραμμές· η είσοδος
 * του αποτυπώματος (`fingerprintShellFile.importSpecs`).
 *
 * 🔴 ΤΟ ΨΕΜΑ ΠΟΥ ΔΙΟΡΘΩΝΕΙ: ως τώρα το αποτύπωμα ήταν `kind + spec`. Ο walk όμως πιστώνει ΑΝΑ ΣΥΜΒΟΛΟ
 * (`creditNamedImport` → `resolveOrigin`, πίσω από barrels): `import {A} from '@/x'` → `{A, B}` μεγάλωνε
 * την κλειστότητα **χωρίς** να αλλάξει αποτύπωμα. Και ένα barrel απαντά με τις ΤΟΠΙΚΕΣ εξαγωγές του και
 * τα re-exports του — άρα κι αυτά είναι επιφάνεια. Ό,τι ΔΕΝ διαβάζει ο walk (σώμα, τοπικές χρήσεις,
 * γραμμές) μένει έξω επίτηδες: αλλιώς κάθε edit θα κοκκίνιζε (μάθημα §31: 44% θόρυβος).
 */
function walkSurface(mod) {
  if (!mod) return [];
  const lines = [];
  for (const imp of mod.imports) lines.push(`${imp.kind} ${imp.spec}${namesOf(imp.names, n => n.imported)}`);
  for (const exp of mod.exports) if (exp.origin === 'local') lines.push(`export ${exp.name}`);
  for (const re of mod.reExports) {
    lines.push(`re-export ${re.kind} ${re.spec}${namesOf(re.names, n => `${n.imported}>${n.exported}`)}${re.as ? ` as ${re.as}` : ''}`);
  }
  return lines.sort();
}

/**
 * Credits a named import to the file that DECLARES each symbol, never to the
 * barrel that forwards it (ADR-700 §10.7.1). `import { Button } from '@/components/ui'`
 * pulls `ui/button.tsx` into the shell — not all 90 modules the barrel re-exports.
 *
 * @returns {boolean} true when at least one symbol was attributed
 */
function creditNamedImport(ctx, targetFile, names) {
  let credited = false;
  for (const n of names) {
    const origin = MG.resolveOrigin(ctx.graph, ctx.resolve, targetFile, n.imported);
    if (origin.opaqueModule) {
      const nsTarget = ctx.resolve(origin.opaqueModule, origin.from);
      if (nsTarget.kind === 'internal') ctx.add(nsTarget.file);
      credited = true;
      continue;
    }
    if (origin.opaque) continue;
    ctx.add(origin.file);
    credited = true;
  }
  return credited;
}

/**
 * One import edge. Order matters: boundaries are tested before attribution, so a
 * `dynamic(() => import('./Heavy'))` never reaches `creditNamedImport`.
 */
function walkImport(ctx, fromFile, imp) {
  const target = ctx.resolve(imp.spec, fromFile);
  if (target.kind === 'external') return;
  if (target.kind === 'unresolved') {
    ctx.unresolvedSpecs.add(`${relPosix(ctx.projectRoot, fromFile)} → ${imp.spec}`);
    return;
  }

  const rel = relPosix(ctx.projectRoot, target.file);
  if (imp.kind === 'dynamic') { ctx.dynamicBoundaries.add(rel); return; }
  if (!ctx.rootSet.has(target.file) && (ROUTE_BOUNDARY.test(rel) || isEntryFile(rel))) {
    ctx.routeBoundaries.add(rel);
    return;
  }

  if (imp.kind === 'namespace' || imp.kind === 'side-effect') { ctx.add(target.file); return; }
  // Fail-safe: a default import whose origin we could not chase, or a named
  // import that resolved to nothing, still brings its module in.
  if (!creditNamedImport(ctx, target.file, imp.names || [])) ctx.add(target.file);
}

/**
 * @param {object} graph            result of MG.buildGraph (or MG.createOnDemandGraph)
 * @param {string[]} rootFiles      absolute posix paths of the shell entry points
 * @param {{resolve?: Function}} [options]  ADR-744 §31 — a resolver SHARED across many closures over
 *   the same graph. Resolution is a pure function of (spec, fromFile), so sharing changes nothing but
 *   cost: 83 lazy closures each re-resolving the same edges measured as the bulk of a warm run.
 * @returns {{files: string[], consulted: string[], dynamicBoundaries: string[], routeBoundaries: string[], unresolvedSpecs: string[]}}
 *   `consulted` = ADR-744 §31: modules the walk READ (barrels on a `resolveOrigin` chain) without
 *   them becoming members. A re-export rewritten there changes the closure, so they are inputs too —
 *   measured: 43 for the shell, 45 for routes, 234 outside every recorded table.
 */
function computeShellClosure(graph, rootFiles, options = {}) {
  const seen = new Set();
  const queue = [];
  const read = new Set();
  // Η ΙΔΙΑ πηγή με όψη που σημειώνει τι διαβάστηκε — ο walk δεν αλλάζει, μόνο παρατηρείται.
  const observed = { ...graph, modules: { get: file => { read.add(file); return graph.modules.get(file); } } };
  const ctx = {
    graph: observed,
    projectRoot: graph.projectRoot,
    resolve: options.resolve || MG.createResolver(graph),
    rootSet: new Set(rootFiles),
    dynamicBoundaries: new Set(),
    routeBoundaries: new Set(),
    unresolvedSpecs: new Set(),
    add(file) { if (!seen.has(file)) { seen.add(file); queue.push(file); } },
  };

  rootFiles.forEach(ctx.add);
  while (queue.length > 0) {
    const mod = graph.modules.get(queue.pop());
    if (!mod) continue;
    for (const imp of mod.imports) walkImport(ctx, mod.file, imp);
  }

  const sorted = set => [...set].sort();
  const consulted = [...read].filter(file => !seen.has(file) && graph.modules.get(file) !== undefined);
  return {
    files: sorted([...seen].map(f => relPosix(graph.projectRoot, f))),
    consulted: sorted(consulted.map(f => relPosix(graph.projectRoot, f))),
    dynamicBoundaries: sorted(ctx.dynamicBoundaries),
    routeBoundaries: sorted(ctx.routeBoundaries),
    unresolvedSpecs: sorted(ctx.unresolvedSpecs),
  };
}

module.exports = { ROUTE_BOUNDARY, relPosix, walkSurface, creditNamedImport, walkImport, computeShellClosure };
