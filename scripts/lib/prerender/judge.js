#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.55 (ADR-785) — Η ΚΡΙΣΗ
 * =============================================================================
 *
 * *«Υπάρχει διαδρομή απόδοσης από τη σελίδα μέχρι ένα `useSearchParams()` που
 * ΔΕΝ περνά από `<Suspense>`;»* Αν ναι, το `next build` **θα πέσει** — όχι ίσως.
 *
 * 🔑 **ΔΥΟ ΣΧΕΣΕΙΣ, ΠΟΤΕ ΜΙΑ ΜΕ «Ή»** (μάθημα CHECK 3.41):
 *   · **κλήση** (`useX()`) — τρέχει ΜΕΣΑ στο σώμα ⇒ **διαδίδει** την εχθρότητα
 *     προς τα πάνω, και **καμία** `<Suspense>` δεν μπορεί να μπει ανάμεσα·
 *   · **απόδοση** (`<X/>`) — μπορεί να τυλιχτεί ⇒ **φρουρήσιμη**.
 * Μια ενιαία σχέση «εξαρτάται από» θα έλεγε «σπασμένο» για κάθε σωστά τυλιγμένο
 * component, δηλαδή θα ήταν θόρυβος πάνω στη ΘΕΡΑΠΕΙΑ.
 *
 * 🔑 **Ο ΠΕΡΙΠΑΤΟΣ ΤΡΕΧΕΙ ΜΟΝΟ ΜΕ `guarded === false`.** Μόλις μια ακμή
 * φρουρηθεί, ό,τι κρέμεται από κάτω είναι **αποδεδειγμένα** εντάξει και κλαδεύεται.
 * Γι' αυτό δεν χρειάζεται σταθερό σημείο: το memo είναι σκέτο `αρχείο|όνομα`.
 *
 * ⛔ **FAIL-CLOSED.** Ακμή που δεν λύνεται (υπολογισμένη ετικέτα, εξωτερικό
 * πακέτο) **δεν σιωπά**: μετριέται ρητά ως `unresolvable-edge`. Ένα «δεν ξέρω»
 * που δεν λέγεται διαβάζεται ως «κοίταξα και είναι καθαρό» — το σχήμα που όλο
 * αυτό το repo κυνηγά.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MG = require('../module-graph');
const { collectSourceFiles } = require('../module-graph/scan-config');
const { analyzeModule } = require('./analyze-module');
const RT = require('./route-tree');

/** ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ. Άγνωστη κατάσταση ⇒ `throw` με όνομα. */
const STATES = Object.freeze({
  BAILOUT: 'bailout-unguarded',
  GUARDED: 'guarded-by-route',
  INLINE_GUARDED: 'guarded-inline',
  CLEAN: 'no-hostile-api',
  OPTED_OUT: 'opted-out-of-prerender',
  NO_ROOT: 'unresolvable-root',
});

const ZERO_TOLERANCE = Object.freeze([STATES.BAILOUT, STATES.NO_ROOT]);
const ALL_STATES = Object.freeze(Object.values(STATES));

/** Ο αναγνώστης: αναλύει κάθε αρχείο **μία** φορά, με τεμπέλικο τρόπο. */
function createReader(projectRoot, fileSet) {
  const cache = new Map();
  const parsed = new Map();
  return {
    fileSet,
    analyze(rel) {
      if (cache.has(rel)) return cache.get(rel);
      const abs = path.join(projectRoot, rel);
      let value = null;
      if (fs.existsSync(abs)) {
        try {
          value = analyzeModule(rel, fs.readFileSync(abs, 'utf8'));
        } catch {
          value = null;
        }
      }
      cache.set(rel, value);
      return value;
    },
    parse(rel) {
      if (parsed.has(rel)) return parsed.get(rel);
      const abs = path.join(projectRoot, rel);
      let value = null;
      if (fs.existsSync(abs)) {
        try {
          value = MG.parseModule(rel, fs.readFileSync(abs, 'utf8'));
        } catch {
          value = null;
        }
      }
      parsed.set(rel, value);
      return value;
    },
  };
}

/**
 * ⚠️ **ΤΟ `resolveSpecifier` ΕΠΙΣΤΡΕΦΕΙ ΑΠΟΛΥΤΟ ΜΟΝΟΠΑΤΙ, Ο ΚΡΙΤΗΣ ΜΙΛΑ ΣΧΕΤΙΚΑ.**
 * Η πρώτη γραφή τα ανακάτεψε: κάθε ακμή **εκτός αρχείου** έσπαγε σιωπηλά και ο
 * περίπατος γινόταν, στην πράξη, **εντός-αρχείου** — με την πύλη να δείχνει
 * **πράσινη** παντού και τη λογιστική να **κλείνει κανονικά**. Το έπιασε μόνο ο
 * κατάλογος τυφλών σημείων **με ΟΝΟΜΑΤΑ** (`SearchLandingContent`,
 * `DemandDetailContent`, `AppHeader`): ένα πλήθος «61» δεν θα είχε πει τίποτα.
 * Η μετατροπή γίνεται **εδώ, μία φορά**, στο σύνορο.
 */
function resolveInternal(spec, fromRel, ctx) {
  const hit = MG.resolveSpecifier(spec, MG.toPosix(path.join(ctx.projectRoot, fromRel)), {
    projectRoot: ctx.projectRoot,
    aliases: ctx.aliases,
    fileSet: ctx.reader.fileSet,
  });
  if (!hit || hit.kind !== 'internal') return null;
  return MG.toPosix(path.relative(ctx.projectRoot, hit.file));
}

/**
 * `(αρχείο, εξαγόμενο όνομα)` → `(αρχείο, τοπικό όνομα)`, ακολουθώντας barrels.
 * Επιστρέφει `null` όταν το σύμβολο δεν είναι δικό μας κώδικας.
 */
function resolveExport(file, exportName, ctx, seen = new Set()) {
  const key = `${file}|${exportName}`;
  if (seen.has(key)) return null;
  seen.add(key);
  if (ctx.exportCache && ctx.exportCache.has(key)) return ctx.exportCache.get(key);
  const value = computeExport(file, exportName, ctx, seen);
  if (ctx.exportCache) ctx.exportCache.set(key, value);
  return value;
}

function computeExport(file, exportName, ctx, seen) {

  const mod = ctx.reader.analyze(file);
  if (!mod) return null;
  if (mod.locals.has(exportName) || mod.dynamicEdges.has(exportName)) return { file, local: exportName };
  if (exportName === 'default' && mod.defaultExport && mod.locals.has(mod.defaultExport)) {
    return { file, local: mod.defaultExport };
  }

  const parsedMod = ctx.reader.parse(file);
  if (!parsedMod) return null;
  for (const re of parsedMod.reExports) {
    const next = resolveInternal(re.spec, file, ctx);
    if (!next) continue;
    if (re.kind === 'named') {
      const match = re.names.find(n => n.exported === exportName);
      if (match) return resolveExport(next, match.imported, ctx, seen);
    } else if (re.kind === 'star') {
      const found = resolveExport(next, exportName, ctx, seen);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Ακμή προς `localName` μέσα στο `mod`: τι είναι, και φρουρείται από μόνη της;
 *
 * ⚡ **ΑΠΟΜΝΗΜΟΝΕΥΣΗ ΤΗΣ ΕΠΙΛΥΣΗΣ, ΟΧΙ ΤΟΥ ΠΕΡΙΠΑΤΟΥ.** Μετρήθηκε ότι το κόστος
 * δεν ήταν η διάσχιση αλλά η **επανάλυση**: κάθε ακμή ξανακατέβαινε την αλυσίδα
 * barrel και ξαναδιάβαζε module με **δεύτερο** TS parse. Απομνημόνευση του
 * **αποτελέσματος του περιπάτου** δοκιμάστηκε πρώτη και ήταν **χειρότερη**
 * (11,2s → 25,1s): αντέγραφε πίνακες ευρημάτων σε κάθε κόμβο. Η μέτρηση
 * διάλεξε — όχι η διαίσθηση.
 */
function resolveEdgeTarget(mod, localName, ctx) {
  const cacheKey = `${mod.file}|${localName}`;
  if (ctx.edgeCache.has(cacheKey)) return ctx.edgeCache.get(cacheKey);
  const value = computeEdgeTarget(mod, localName, ctx);
  ctx.edgeCache.set(cacheKey, value);
  return value;
}

function computeEdgeTarget(mod, localName, ctx) {
  if (mod.locals.has(localName)) return { file: mod.file, local: localName, guardedByEdge: false };
  const dyn = mod.dynamicEdges.get(localName);
  if (dyn) {
    // ⚠️ ADR-744 §14.2: `next/dynamic` ΧΩΡΙΣ `ssr:false` ΔΕΝ είναι φρουρός.
    if (dyn.guarded) return { guardedByEdge: true };
    const next = resolveInternal(dyn.spec, mod.file, ctx);
    if (!next) return null;
    const target = resolveExport(next, 'default', ctx);
    return target ? { ...target, guardedByEdge: false } : null;
  }
  const binding = mod.bindings.get(localName);
  if (!binding) return null;
  const next = resolveInternal(binding.spec, mod.file, ctx);
  if (!next) return null;
  const target = resolveExport(next, binding.imported, ctx);
  return target ? { ...target, guardedByEdge: false } : null;
}

/**
 * Ο περίπατος από μία ρίζα.
 *
 * Με `ignoreGuards: false` (η **ΚΡΙΣΗ**) τα φρουρημένα κλαδιά κλαδεύονται, οπότε
 * ό,τι βρεθεί είναι **αφρούρητο εξ ορισμού** και το build θα πέσει.
 *
 * Με `ignoreGuards: true` (η **ΟΡΑΤΟΤΗΤΑ**) απαντά το άλλο ερώτημα: *«έχει καν
 * αυτή η ρίζα κάτι να φρουρηθεί;»*. ⚠️ Χωρίς αυτό, ένα «φρουρημένο» διαβάζεται
 * ως απόδειξη ότι ο φρουρός δουλεύει — ενώ μπορεί απλώς να μην υπάρχει τίποτα
 * να φρουρήσει. Ένα άθροισμα που δεν ρωτά **ποιος κρίθηκε** επικυρώνει τον
 * εαυτό του (μάθημα CHECK 3.39 `Κ1` / CHECK 3.40).
 *
 * @returns {{hits: object[], unresolved: number}}
 */
function walkUnguarded(startFile, startLocal, ctx, options = {}) {
  const ignoreGuards = options.ignoreGuards === true;
  const seen = new Set();
  const hits = [];
  // ⚠️ ΟΝΟΜΑΤΑ, όχι πλήθος: ένα τυφλό σημείο που δεν λέει ΠΟΙΟ είναι, δεν
  // ελέγχεται ποτέ (μάθημα CHECK 3.35 `unanalyzable: 194`).
  const unresolvedNames = new Set();
  const queue = [{ file: startFile, local: startLocal }];

  while (queue.length > 0) {
    const { file, local } = queue.pop();
    const key = `${file}|${local}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const mod = ctx.reader.analyze(file);
    const node = mod && mod.locals.get(local);
    if (!node) continue;

    for (const callee of node.calls) {
      if (mod.hostileLocals.has(callee)) {
        hits.push({ file, local, api: callee });
        continue;
      }
      const target = resolveEdgeTarget(mod, callee, ctx);
      if (target && target.file) queue.push({ file: target.file, local: target.local });
    }
    for (const edge of node.renders) {
      if (edge.guarded && !ignoreGuards) continue; // φρουρημένο ⇒ αποδεδειγμένα εντάξει ⇒ κλάδεμα
      const target = resolveEdgeTarget(mod, edge.name, ctx);
      if (!target) {
        if (isOwnComponentName(edge.name)) unresolvedNames.add(`${file}:${edge.name}`);
        continue;
      }
      if ((target.guardedByEdge && !ignoreGuards) || !target.file) continue;
      queue.push({ file: target.file, local: target.local });
    }
  }
  return { hits, unresolved: unresolvedNames.size, unresolvedNames: [...unresolvedNames].sort() };
}

/** `<div>` δεν είναι δικό μας component· `<Foo>` είναι. Πεζό πρώτο γράμμα = DOM. */
function isOwnComponentName(name) {
  return /^[A-Z]/.test(name);
}

/**
 * «Αγγίζει καν εχθρικό API η κλειστότητα αυτής της ρίζας;» — ανεξάρτητα φρουρών.
 * Είναι ο **παρονομαστής**: χωρίς αυτόν το «φρουρημένο» δεν ξεχωρίζει από το
 * «δεν είχε τίποτα να φρουρήσει».
 */
function reachesHostile(route, ctx) {
  const mod = ctx.reader.analyze(route.file);
  const entry = mod && mod.defaultExport;
  if (!entry || !mod.locals.has(entry)) return false;
  return walkUnguarded(route.file, entry, ctx, { ignoreGuards: true }).hits.length > 0;
}

/** Η ετυμηγορία μιας ρίζας — **ακριβώς μία** κατάσταση. */
function judgeRoot(route, ctx) {
  const read = rel => ctx.reader.analyze(rel);
  const base = { ...route, hits: [], unresolved: 0, hostileInClosure: reachesHostile(route, ctx) };

  const optOut = RT.routeOptOut(ctx.projectRoot, route, read);
  if (optOut) return { ...base, state: STATES.OPTED_OUT, detail: optOut };

  const guard = RT.routeGuard(ctx.projectRoot, route, read);
  if (guard.guarded) return { ...base, state: STATES.GUARDED, detail: guard.reason };

  const mod = read(route.file);
  const entry = mod && mod.defaultExport;
  if (!entry || !mod.locals.has(entry)) {
    const detail = entry ? `default=${entry}` : 'χωρίς αναλύσιμο default export';
    return { ...base, state: STATES.NO_ROOT, detail };
  }

  const { hits, unresolved, unresolvedNames } = walkUnguarded(route.file, entry, ctx);
  if (hits.length > 0) {
    return { ...base, state: STATES.BAILOUT, detail: hits[0].api, hits, unresolved, unresolvedNames };
  }
  const state = base.hostileInClosure ? STATES.INLINE_GUARDED : STATES.CLEAN;
  return { ...base, state, detail: null, unresolved, unresolvedNames };
}

/** ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ: κάθε σελίδα σε ακριβώς έναν κάδο, ή `throw` με όνομα. */
function assertClosed(records) {
  const census = Object.fromEntries(ALL_STATES.map(state => [state, 0]));
  for (const record of records) {
    if (!(record.state in census)) {
      throw new Error(`CHECK 3.55: άγνωστη κατάσταση "${record.state}" στο ${record.file}`);
    }
    census[record.state] += 1;
  }
  const total = Object.values(census).reduce((a, b) => a + b, 0);
  if (total !== records.length) {
    throw new Error(`CHECK 3.55: η λογιστική δεν κλείνει — ${total} έναντι ${records.length}`);
  }
  return census;
}

function judgeAll(projectRoot) {
  const fileSet = new Set(collectSourceFiles(projectRoot, ['src']).map(MG.toPosix));
  const ctx = {
    projectRoot,
    aliases: MG.readTsPathAliases(projectRoot, 'tsconfig.base.json').concat(
      MG.readTsPathAliases(projectRoot, 'tsconfig.json')
    ),
    reader: createReader(projectRoot, fileSet),
    edgeCache: new Map(),
    exportCache: new Map(),
  };
  const records = RT.enumerateRoots(projectRoot).map(route => judgeRoot(route, ctx));
  return { records, census: assertClosed(records), ctx };
}

module.exports = { STATES, ZERO_TOLERANCE, ALL_STATES, judgeAll, judgeRoot, walkUnguarded, resolveExport, createReader, assertClosed };
