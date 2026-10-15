#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 §32 — CHECK 3.34 G: ΚΕΛΥΦΟΣ + ΔΙΑΔΡΟΜΕΣ, ΕΠΑΥΞΗΤΙΚΑ, ΜΕ EARLY CUTOFF ΣΤΗ ΔΕΣΜΕΥΜΕΝΗ ΕΞΟΔΟ
 * =============================================================================
 *
 * «Παράγει ο κώδικας του commit ΑΚΟΜΗ ό,τι λέει το δεσμευμένο manifest — για όσες κλειστότητες άγγιξε;»
 *
 * 🔴 ΤΟ ΠΡΟΒΛΗΜΑ (μετρημένο §32.1): ο C κρίνει με αποτύπωμα ανά αρχείο, άρα κοκκινίζει όταν αλλάζει
 * **είσοδος**, όχι **έξοδος**: 96 κόκκινα σε 200 commits, 24 πραγματικά — **78% ψευδώς θετικά**, και
 * κάθε ψευδές κόστιζε αναγέννηση ~184 s. Ο πήχης του N.12 για blocking checks είναι ≤10%.
 *
 * 🏆 ΤΟ ΣΧΗΜΑ (Bazel change pruning · Buck2 DICE · Salsa), σε τέσσερα βήματα:
 *   1. **σκανδάλη** — αποτύπωμα ΓΟΝΕΑ ≠ COMMIT ανά σταδιοποιημένο module (σώμα/σχόλια ⇒ ίδιο ⇒ 0 s)·
 *   2. **συμμετοχή** — ποιες κλειστότητες διάβασαν το αλλαγμένο, με τον ΙΔΙΟ walk, σε ΚΑΙ ΤΙΣ ΔΥΟ
 *      καταστάσεις (`closure-participation.js`)· όχι πίνακας που παλιώνει·
 *   3. **στοχευμένος επανυπολογισμός** — το κέλυφος μόνο αν το άγγιξε· διαδρομές μόνο όσες άγγιξε·
 *   4. **cutoff** — κόκκινο ΜΟΝΟ αν η έξοδος ≠ δεσμευμένη (`shellProjection`/`routeProjection`).
 * ΠΑΡΑΠΑΝΩ από τους μεγάλους: το cutoff δεν γίνεται σε cache εργασιών αλλά στην **ΔΕΣΜΕΥΜΕΝΗ** έξοδο ⇒
 * η μνήμη μπορεί να κάνει την πύλη γρήγορη, ποτέ λάθος. Και κλιμακωτό: κέλυφος που άλλαξε ⇒ κόκκινο
 * χωρίς να χτιστεί καμία διαδρομή (κάθε διαδρομή αφαιρεί το κέλυφος — όλες θα ήταν μπαγιάτικες).
 *
 * ⚠️ ΠΡΟΣΘΕΤΙΚΟ: ο C μένει ενεργός μέχρι η μετάλλαξη + αναπαραγωγή να αποδείξουν ότι ο G πιάνει ό,τι
 * έπιανε εκείνος (§32.5 #6). Πριν από αυτό, κανένας πίνακας δεν αποσύρεται.
 *
 * @module scripts/lib/i18n-shell-slice/incremental-freshness
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MG = require('../module-graph');
const P = require('./plan');
const RS = require('./route-slices');
const { stableStringify, sha256, fingerprintShellFile } = require('./slice-build');
const { shellProjection, routeProjection, serializeRouteWants } = require('./manifest-build');
const { affectedClosures } = require('./closure-participation');
const { isWalkedSource } = require('./source-cache');

const LIMIT = 6;
const same = (a, b) => stableStringify(a) === stableStringify(b);

/** Αποτύπωμα του αρχείου σε ΜΙΑ κατάσταση· `null` = δεν υπάρχει εκεί (προστέθηκε / σβήστηκε). */
function fingerprintIn(root, config, graph, rel) {
  if (!graph.fileSet.has(MG.toPosix(path.join(root, rel)))) return null;
  return fingerprintShellFile(P.analyseFile(root, rel, graph, P.planContext(root, config, graph)));
}

/** Βήμα 1 — τα σταδιοποιημένα modules που άλλαξαν ΕΠΙΦΑΝΕΙΑ (χωρίς γονέα: όλα). */
function changedModules(pass) {
  const { root, config } = pass;
  const staged = [...new Set(pass.stagedFiles.filter(isWalkedSource))];
  if (staged.length === 0) return { staged, changed: [] };
  const { graph } = pass.commit();
  const parent = pass.parent();
  if (parent === null) return { staged, changed: staged };
  const changed = staged.filter(rel => fingerprintIn(root, config, parent, rel) !== fingerprintIn(root, config, graph, rel));
  return { staged, changed };
}

/** `ns: +κλειδί −κλειδί` — ό,τι μπήκε/βγήκε, ποτέ γενικό «άλλαξε». */
function describeWantsDrift(committed = {}, fresh = {}) {
  const lines = [];
  for (const namespace of [...new Set([...Object.keys(committed), ...Object.keys(fresh)])].sort()) {
    const before = committed[namespace] || { keys: [], prefixes: [] };
    const after = fresh[namespace] || { keys: [], prefixes: [] };
    const diff = (field, mark) => {
      const was = new Set(before[field] || []);
      const now = new Set(after[field] || []);
      return [...[...now].filter(k => !was.has(k)).map(k => `+${k}${mark}`), ...[...was].filter(k => !now.has(k)).map(k => `−${k}${mark}`)];
    };
    const changes = [...diff('keys', ''), ...diff('prefixes', '*')];
    if (Boolean(before.whole) !== Boolean(after.whole)) changes.push(after.whole ? '+ΟΛΟΚΛΗΡΟ' : '−ΟΛΟΚΛΗΡΟ');
    if (!(namespace in committed)) changes.unshift(`νέο namespace${after.from && after.from[0] ? ` (από ${after.from[0]})` : ''}`);
    if (!(namespace in fresh)) changes.unshift('δεν ζητείται πια');
    if (changes.length > 0) lines.push(`${namespace}: ${changes.slice(0, LIMIT).join(' ')}${changes.length > LIMIT ? ` …(+${changes.length - LIMIT})` : ''}`);
  }
  return lines;
}

function describeShellDrift(committed, fresh) {
  const fields = Object.keys(fresh).filter(field => !same(committed[field], fresh[field]));
  const parts = fields.filter(field => field !== 'wants');
  const drift = fields.includes('wants') ? describeWantsDrift(committed.wants, fresh.wants) : [];
  return [...drift, ...(parts.length > 0 ? [`πεδία manifest: ${parts.join(', ')}`] : [])].join(' · ');
}

function violationText(violations) {
  const [first] = violations;
  return `${violations.length} ανεπίλυτη(-ες) δυναμική(-ές) t(), π.χ. ${first.file}:${first.line} — ${first.snippet}`;
}

/** Βήμα 3+4 για το κέλυφος. `null` = ίδια έξοδος. */
function judgeShell(pass, manifest) {
  const { root, config } = pass;
  const plan = P.buildShellPlan(root, config, pass.commit().graph);
  if (plan.violations.length > 0) return `G. κέλυφος: ${violationText(plan.violations)}`;
  const rendered = P.renderArtifacts(root, config, plan);
  const paths = [...rendered.artifacts.keys()];
  const committed = shellProjection(manifest, paths);
  const fresh = shellProjection(JSON.parse(rendered.manifestText), paths);
  return same(committed, fresh) ? null : `G. κέλυφος: η έξοδος δεν είναι πια η δεσμευμένη — ${describeShellDrift(committed, fresh)}`;
}

/** Το ΔΕΣΜΕΥΜΕΝΟ κέλυφος, απέναντι στο οποίο αφαιρείται κάθε διαδρομή (ίδιο με το φρέσκο, αλλιώς σταματήσαμε). */
function committedShell(root, config, manifest) {
  const [language] = config.languages;
  const file = path.join(root, config.outputDir, P.sliceName(language));
  if (!fs.existsSync(file)) return null;   // το λέει το A
  const whole = Object.entries(manifest.wants || {}).filter(([, want]) => want && want.whole).map(([ns]) => ns);
  return { slice: JSON.parse(fs.readFileSync(file, 'utf8')), whole };
}

/** Βήμα 3+4 για μία διαδρομή. `null` = ίδια έξοδος. */
function judgeRoute(pass, manifest, shell, page) {
  const { root, config } = pass;
  const url = RS.routeUrlFor(page);
  let route;
  try {
    route = RS.buildRouteSlice(root, config, pass.commit().graph, page, shell.slice, shell.whole);
  } catch (error) {
    return `G. ${url}: δεν χτίζεται — ${error.message}`;
  }
  if (route.violations.length > 0) return `G. ${url}: ${violationText(route.violations)}`;
  const committed = routeProjection(manifest, route.id, route.artifactPath);
  const fresh = { route: serializeRouteWants([route])[route.id], artifact: sha256(stableStringify(route.resources)) };
  if (same(committed, fresh)) return null;
  const drift = describeWantsDrift(committed.route && committed.route.wants, fresh.route.wants);
  return `G. ${url}: η έξοδος δεν είναι πια η δεσμευμένη — ${drift.join(' · ') || 'ίδια κλειδιά, άλλο slice'}`;
}

function judgeIncremental(pass, manifest) {
  const started = Date.now();
  const { staged, changed } = changedModules(pass);
  if (changed.length === 0) return { reasons: [], stats: staged.length === 0 ? null : { staged: staged.length, changed: 0, ms: Date.now() - started } };
  const graphs = [pass.commit().graph, pass.parent()].filter(Boolean);
  const walkStarted = Date.now();
  const affected = affectedClosures({ root: pass.root, config: pass.config, graphs, changed });
  const stats = { staged: staged.length, changed: changed.length, shell: affected.shell, routes: affected.routes.length, walkMs: Date.now() - walkStarted };
  const reasons = [];
  const shellRed = affected.shell ? judgeShell(pass, manifest) : null;
  if (shellRed !== null) {
    reasons.push(shellRed);
  } else if (affected.routes.length > 0) {
    const shell = committedShell(pass.root, pass.config, manifest);
    if (shell !== null) {
      for (const page of affected.routes) {
        const red = judgeRoute(pass, manifest, shell, page);
        if (red !== null) reasons.push(red);
      }
    }
  }
  return { reasons, stats: { ...stats, ms: Date.now() - started } };
}

/**
 * @param {object} args
 * @param {object} args.manifest  το ΔΕΣΜΕΥΜΕΝΟ manifest (δίσκος ή στιγμιότυπο ευρετηρίου)
 * @param {object} args.pass      το κοινό πέρασμα (`layer-one-pass.js`)
 * @returns {{reasons: string[], stats: ?object}} `stats` = `null` όταν δεν σταδιοποιήθηκε module
 */
function checkIncrementalFreshness({ manifest, pass }) {
  try {
    return judgeIncremental(pass, manifest);
  } catch (error) {
    return { reasons: [`G. κέλυφος/διαδρομές δεν μπορούν να κριθούν — ${error.message}`], stats: null };
  }
}

module.exports = { changedModules, describeWantsDrift, judgeShell, judgeRoute, checkIncrementalFreshness };
