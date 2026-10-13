#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.104 — Η ΠΥΛΗ ΤΟΥ ΕΝΟΣ ΔΡΟΜΟΥ ΤΗΣ ΠΑΡΟΥΣΙΑΣ ΠΕΡΙΗΓΗΣΗΣ (ADR-884 · ADR-777 §8.88)
 * =============================================================================
 *
 * «Γράφει κάποιος περιήγηση ή λήψη ΧΩΡΙΣ να ζητήσει επαναπροβολή της αγγελίας — ή φτιάχνει κάποιος άλλος το
 *  `PublicListing.tour`;»
 *
 * 🔴 ΓΙΑΤΙ: το `tour` της δημόσιας αγγελίας είναι ΑΝΤΙΓΡΑΦΟ της απάντησης του `readTourPresence` (υπάρχει για να μη
 * ρωτά η κάρτα αναζήτησης το endpoint ανά αγγελία). Η απάντηση αλλάζει από πράξεις της ΠΕΡΙΗΓΗΣΗΣ, που δεν αγγίζουν το
 * ακίνητο — άρα κανένας υπάρχων δρόμος επαναδημοσίευσης δεν θα τις έβλεπε. Γραφέας που «ξεχνά» τον δρόμο αφήνει την
 * κάρτα να διαφημίζει «3D περιήγηση» που αποσύρθηκε, ή να σιωπά για μία που μόλις δημοσιεύτηκε.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ ───────────────────────────────────────────────────────────────────────
 *  Κ1 κάθε αρχείο που γράφει σε `tourRef`/`captureRef` είναι ΔΗΛΩΜΕΝΟ: γραφέας παρουσίας ή εξαίρεση με λόγο
 *  Κ2 κάθε δηλωμένος γραφέας καλεί τον δρόμο ≥ `min` φορές· κάθε καλών του δρόμου είναι δηλωμένος (κλειστό σύνολο)
 *  Κ3 την περικοπή `TourPresence → ListingTourPresence` την κάνουν ΜΟΝΟ ο δέτης και ο δρόμος
 *  Κ4 κάθε εξαίρεση έχει λόγο ≥ 40 χαρακτήρων και αφορά αρχείο που ΟΝΤΩΣ γράφει (όχι νεκρή γραμμή)
 *
 * ⚠️ ΤΙ ΔΕΝ ΒΛΕΠΕΙ (δηλωμένο): το Κ1 αναγνωρίζει τον στόχο από το ΟΝΟΜΑ της αναφοράς (`tourRef` · `captureRef` — η
 * σύμβαση όλου του `server/spatial-tour`). Εγγραφή μέσω αναφοράς με άλλο όνομα περνά αόρατη· την πιάνει το βραδινό
 * δίχτυ (`reconcileListingTours`: `healed > 0`), όχι αυτή η πύλη. ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ.
 *
 * @see ADR-884 · ADR-777 §8.88 · docs/gates/3.104.md · αδελφές: CHECK 3.99 · 3.102 (`lib/write-authority/ast`)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ast = require('./lib/write-authority/ast');
const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const { toPosix } = require('./lib/module-graph/resolve-specifier');

const { ts, PROJECT_ROOT } = ast;
const REGISTRY_FILE = '.tour-presence-authority.json';
const WRITE_METHODS = new Set(['set', 'update', 'create', 'delete']);
const TARGET_NAMES = new Set(['tourRef', 'captureRef']);
const MIN_REASON_LENGTH = 40;

const STATES = {
  PRESENCE_WRITER: 'declared-presence-writer',
  EXEMPT: 'exempt-with-reason',
  UNDECLARED_WRITER: 'undeclared-tour-writer',
  MISSING_REFRESH: 'presence-writer-without-refresh',
  UNDECLARED_CALLER: 'undeclared-refresh-caller',
  SECOND_BINDER: 'listing-tour-bound-outside-binder',
  EXEMPT_NO_REASON: 'exempt-without-reason',
  STALE_EXEMPTION: 'exempt-file-does-not-write',
  SOURCE_DRIFT: 'source-drift',
};
const BLOCKING = [
  STATES.UNDECLARED_WRITER, STATES.MISSING_REFRESH, STATES.UNDECLARED_CALLER, STATES.SECOND_BINDER,
  STATES.EXEMPT_NO_REASON, STATES.STALE_EXEMPTION, STATES.SOURCE_DRIFT,
];

function loadRegistry(root) {
  return JSON.parse(fs.readFileSync(path.join(root, REGISTRY_FILE), 'utf8'));
}

/** Το τελευταίο όνομα μιας έκφρασης: `tourRef` · `ctx.tourRef` · `plan.captureRef` ⇒ το δεξιότερο αναγνωριστικό. */
function trailingName(expression) {
  if (!expression) return null;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

/** `tx.update(tourRef, …)` (ο στόχος είναι το 1ο όρισμα) ή `tourRef.update(…)` (ο στόχος είναι ο δέκτης). */
function tourWriteTarget(call) {
  const callee = call.expression;
  if (!ts.isPropertyAccessExpression(callee) || !WRITE_METHODS.has(callee.name.text)) return null;
  const receiver = trailingName(callee.expression);
  if (TARGET_NAMES.has(receiver)) return receiver;
  const firstArgument = trailingName(call.arguments[0]);
  return TARGET_NAMES.has(firstArgument) ? firstArgument : null;
}

/** Το όνομα της συνάρτησης που καλείται άμεσα (`f(` ή `x.f(`). */
function calleeName(call) {
  return trailingName(call.expression);
}

/** Όσα ενδιαφέρουν την πύλη σε ένα αρχείο, σε ένα πέρασμα. */
function scan(sf) {
  const facts = { writes: [], calls: [] };
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const target = tourWriteTarget(node);
      if (target) facts.writes.push({ target, line: ast.lineOf(sf, node) });
      const name = calleeName(node);
      if (name) facts.calls.push({ name, line: ast.lineOf(sf, node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return facts;
}

/** Κ1 + Κ2 (αδήλωτος καλών) + Κ3 για ένα αρχείο. */
function findingsIn(rel, facts, registry) {
  const findings = [];
  const declared = registry.presenceWriters[rel] !== undefined || registry.exemptWriters[rel] !== undefined;
  if (!declared) {
    for (const write of facts.writes) {
      findings.push({ state: STATES.UNDECLARED_WRITER, file: rel, line: write.line,
        detail: `γράφει σε \`${write.target}\` χωρίς δήλωση — πρόσθεσέ το στο ${REGISTRY_FILE} (presenceWriters με min + why, ή exemptWriters με λόγο)` });
    }
  }
  const refreshNames = new Set(registry.refreshFunctions);
  if (rel !== registry.refresher && registry.presenceWriters[rel] === undefined) {
    for (const call of facts.calls.filter((c) => refreshNames.has(c.name))) {
      findings.push({ state: STATES.UNDECLARED_CALLER, file: rel, line: call.line,
        detail: `καλεί \`${call.name}\` χωρίς δήλωση — το μητρώο πρέπει να ξέρει ΚΑΘΕ γραφέα παρουσίας` });
    }
  }
  const binderNames = new Set(registry.binderFunctions);
  if (rel !== registry.binder && rel !== registry.refresher) {
    for (const call of facts.calls.filter((c) => binderNames.has(c.name))) {
      findings.push({ state: STATES.SECOND_BINDER, file: rel, line: call.line,
        detail: `καλεί \`${call.name}\` — το \`PublicListing.tour\` το δένει ΜΟΝΟ ο ${registry.binder}` });
    }
  }
  return findings;
}

/** Κ2 (η άλλη μεριά) + Κ4 + ύπαρξη δηλωμένων αρχείων. Αρχείο εκτός προφίλτρου = ΜΗΔΕΝ, ποτέ σιωπή. */
function declaredFindings(root, registry, factsByFile) {
  const findings = [];
  const exists = (file) => fs.existsSync(path.join(root, file));
  const factsOf = (file) => factsByFile.get(file) || { writes: [], calls: [] };
  const declared = [registry.refresher, registry.binder, ...Object.keys(registry.presenceWriters), ...Object.keys(registry.exemptWriters)];
  for (const file of declared.filter((f) => !exists(f))) {
    findings.push({ state: STATES.SOURCE_DRIFT, file, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
  }
  for (const [file, spec] of Object.entries(registry.presenceWriters).filter(([f]) => exists(f))) {
    const count = factsOf(file).calls.filter((c) => registry.refreshFunctions.includes(c.name)).length;
    findings.push(count >= spec.min
      ? { state: STATES.PRESENCE_WRITER, file }
      : { state: STATES.MISSING_REFRESH, file, detail: `${count}/${spec.min} κλήσεις ${registry.refreshFunctions.join(' | ')} — ${spec.why}` });
  }
  for (const [file, reason] of Object.entries(registry.exemptWriters).filter(([f]) => exists(f))) {
    if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH) {
      findings.push({ state: STATES.EXEMPT_NO_REASON, file, detail: `εξαίρεση χωρίς λόγο ≥ ${MIN_REASON_LENGTH} χαρακτήρων` });
    } else if (factsOf(file).writes.length === 0) {
      findings.push({ state: STATES.STALE_EXEMPTION, file, detail: 'εξαιρείται αλλά δεν γράφει πια σε περιήγηση/λήψη — σβήσε τη γραμμή' });
    } else {
      findings.push({ state: STATES.EXEMPT, file });
    }
  }
  return findings;
}

const RELEVANT = /tourRef|captureRef|refreshListingAfterTourChange|refreshListingOfTour|listedTourFromPresence|listedTourOf/;

function measure(opts = {}) {
  const root = opts.root || PROJECT_ROOT;
  const registry = opts.registry || loadRegistry(root);
  const files = (opts.codeFiles || collectSourceFiles(root, ['src'])).filter((f) => !/__tests__|\.test\.|\.spec\./.test(f));
  if (!opts.codeFiles && files.length < 1000) throw new Error(`ΦΡΟΥΡΟΣ: μόνο ${files.length} αρχεία — η σάρωση δεν κοίταξε`);
  const findings = [];
  const factsByFile = new Map();
  for (const abs of files) {
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (!RELEVANT.test(text)) continue;
    const rel = toPosix(path.relative(root, abs));
    const facts = scan(ast.sourceFileOf(abs, text));
    factsByFile.set(rel, facts);
    findings.push(...findingsIn(rel, facts, registry));
  }
  findings.push(...declaredFindings(root, registry, factsByFile));
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, findings.filter((f) => f.state === s).length]));
  return { findings, tally, examined: files.length };
}

function report(result, log = console.log) {
  const { tally, findings } = result;
  log('');
  log('🧭 CHECK 3.104 — Πύλη του ενός δρόμου της παρουσίας περιήγησης (ADR-884 · ADR-777 §8.88)');
  log(`   αρχεία που εξετάστηκαν: ${result.examined}`);
  log('');
  for (const s of BLOCKING) log(`   ⛔ ${s.padEnd(36)} ${tally[s]}`);
  for (const s of [STATES.PRESENCE_WRITER, STATES.EXEMPT]) log(`   ✅ ${s.padEnd(36)} ${tally[s]}`);
  const blocking = findings.filter((f) => BLOCKING.includes(f.state));
  for (const f of blocking) log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}\n        ${f.detail}`);
  if (blocking.length) {
    log('\n   ΘΕΡΑΠΕΙΑ: μετά το commit της συναλλαγής → `refreshListingAfterTourChange(db, subject)` (ή `refreshListingOfTour`');
    log(`   όταν κρατάς μόνο την περιήγηση), και γραμμή στο ${REGISTRY_FILE}. ⚠️ ΜΗΝ γράψεις το \`tour\` της αγγελίας με το χέρι.`);
  }
  return blocking.length;
}

function main() {
  if (process.env.SKIP_TOUR_PRESENCE_AUTHORITY === '1') {
    console.log('⏭️  CHECK 3.104 παραλείφθηκε (SKIP_TOUR_PRESENCE_AUTHORITY=1)');
    return 0;
  }
  const blocking = report(measure());
  console.log(blocking > 0
    ? `\n❌ CHECK 3.104 ΑΠΕΤΥΧΕ — ${blocking} μπλοκάρουσα(ες) παραβίαση(εις)\n`
    : '\n✅ CHECK 3.104 — κάθε γραφέας περιήγησης ζητά επαναπροβολή, και το `tour` το δένει ένας\n');
  return blocking > 0 ? 1 : 0;
}

if (require.main === module) process.exit(main());

module.exports = { measure, report, main, loadRegistry, STATES, BLOCKING, REGISTRY_FILE };
