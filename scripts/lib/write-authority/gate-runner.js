/**
 * Ο κοινός σκελετός των πυλών «ΕΝΑΣ γραφέας» (CHECK 3.83 · 3.87 · 3.88 · 3.89 · 3.99 · 3.100 · 3.102 · 3.104 · 3.105 · 3.106).
 * Τρεις μορφές δήλωσης: `defineRegistryGate` (κρίση με ΜΗΤΡΩΟ) · `defineScanGate` (προφίλτρο + καλωδίωση) · `gateEntry`
 * (δική της μέτρηση, κοινό `report`/`main`). Όλες διαβάζουν από την ΕΙΣΟΔΟ της πύλης (`gate-input`, ADR-924).
 *
 * Κάθε τέτοια πύλη κάνει τα ίδια τρία πράγματα με άλλο αντικείμενο: σαρώνει το `src/` με προφίλτρο κειμένου και AST ανά
 * αρχείο → κρίνει τις δηλώσεις του μητρώου → τυπώνει κατάστιχο και μπλοκάρει. Εδώ ζει ΜΙΑ φορά ο σκελετός· η πύλη
 * κρατά μόνο ό,τι τη διαφοροποιεί (τι διαβάζει από ένα αρχείο, τι κρίνει, τι λέει στη θεραπεία).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-23, ADR-920 §12): η 3.105 γράφτηκε στο πρότυπο της 3.104 και το CHECK 3.28 (jscpd --diff)
 * βρήκε τα `measure`/`report`/`main` τους δίδυμα. Ο κανόνας N.18: ένα module, δύο καταναλωτές.
 */

'use strict';

const path = require('path');

const { toPosix } = require('../module-graph/resolve-specifier');
const { scanScope, commitInput } = require('../gate-input');
const { sourceFileOf } = require('./ast');

/** Κάθε αρχείο του πεδίου που περνά το προφίλτρο κειμένου: `visit(abs, rel, text)`. */
function forEachRelevant(scope, relevant, visit) {
  for (const abs of scope.files) {
    const text = scope.input.read(abs);
    if (text === null || !relevant.test(text)) continue;
    visit(abs, toPosix(path.relative(scope.root, abs)), text);
  }
}

/** Πλήθος ευρημάτων ανά κατάσταση — κάθε κατάσταση εμφανίζεται, και με μηδέν. */
function tallyOf(findings, states) {
  return Object.fromEntries(Object.values(states).map((s) => [s, findings.filter((f) => f.state === s).length]));
}

/**
 * Σάρωση + κρίση, με το μητρώο της πύλης. `gate` = `{ projectRoot, loadRegistry(root, input), relevant(registry) → RegExp,
 * scan(sf, registry) → facts, findingsIn(rel, facts, registry), declaredFindings(root, registry, factsByFile, input), states }`.
 * Οι δηλώσεις κρίνονται και για αρχείο εκτός προφίλτρου (κενά facts) — ποτέ σιωπή. `opts` = `scanScope` + `{ registry }`.
 */
function measureGate(opts, gate) {
  const scope = scanScope(opts, gate.projectRoot);
  const registry = opts.registry || gate.loadRegistry(scope.root, scope.input);
  const findings = [];
  const factsByFile = new Map();
  forEachRelevant(scope, gate.relevant(registry), (abs, rel, text) => {
    const facts = gate.scan(sourceFileOf(abs, text), registry);
    factsByFile.set(rel, facts);
    findings.push(...gate.findingsIn(rel, facts, registry));
  });
  findings.push(...gate.declaredFindings(scope.root, registry, factsByFile, scope.input));
  return { findings, tally: tallyOf(findings, gate.states), examined: scope.files.length };
}

/** Κατάστιχο: μπλοκάρουσες, υγιείς, και κάθε εύρημα με θεραπεία. Επιστρέφει το πλήθος των μπλοκαρουσών. */
function printReport(result, { title, blocking, healthy, width, remedy }, log = console.log) {
  const { tally, findings } = result;
  log('');
  log(title);
  log(`   αρχεία που εξετάστηκαν: ${result.examined}`);
  log('');
  for (const s of blocking) log(`   ⛔ ${s.padEnd(width)} ${tally[s]}`);
  for (const s of healthy) log(`   ✅ ${s.padEnd(width)} ${tally[s]}`);
  const blocked = findings.filter((f) => blocking.includes(f.state));
  for (const f of blocked) log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}\n        ${f.detail}`);
  if (blocked.length) log(`\n${remedy.map((line) => `   ${line}`).join('\n')}`);
  return blocked.length;
}

/**
 * Κατάστιχο με ενότητα «ΕΥΡΗΜΑΤΑ» (3.81 · 3.83): τίτλος · εξετάστηκαν · `subtitle` · μπλοκάρουσες · υγιείς · κάθε εύρημα
 * με τις γραμμές του `details(f)` · θεραπεία (μόνο όταν υπάρχει εύρημα). 🧹 Ήταν δίδυμο σε δύο πύλες (jscpd, ADR-924 §8.8).
 * @returns {number} πλήθος μπλοκαρουσών
 */
function printFindingsReport(result, { title, subtitle, blocking, healthy, width = 24, details = (f) => [f.detail], remedy },
  log = console.log) {
  const { tally, findings } = result;
  log('');
  log(title);
  log('');
  log(`   αρχεία που εξετάστηκαν: ${result.examined}`);
  if (subtitle) log(`   ${subtitle}`);
  log('');
  for (const s of blocking) log(`   ⛔ ${s.padEnd(width)} ${tally[s]}`);
  log('');
  for (const s of healthy) log(`   ✅ ${s.padEnd(width)} ${tally[s]}`);
  const blocked = findings.filter((f) => blocking.includes(f.state));
  if (blocked.length) {
    log('');
    log('   ── ΕΥΡΗΜΑΤΑ ──');
    for (const f of blocked) {
      log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}`);
      for (const line of details(f)) log(`        ${line}`);
    }
    log('');
    for (const line of remedy) log(`   ${line}`);
  }
  return blocked.length;
}

/** Το `main` της πύλης: παράκαμψη μόνο με μεταβλητή περιβάλλοντος, ετυμηγορία, κωδικός εξόδου. */
function runGate({ check, skipEnv, run, ok }) {
  if (process.env[skipEnv] === '1') {
    console.log(`⏭️  CHECK ${check} παραλείφθηκε (${skipEnv}=1)`);
    return 0;
  }
  const blocking = run();
  console.log(blocking > 0
    ? `\n❌ CHECK ${check} ΑΠΕΤΥΧΕ — ${blocking} μπλοκάρουσα(ες) παραβίαση(εις)\n`
    : `\n✅ CHECK ${check} — ${ok}\n`);
  return blocking > 0 ? 1 : 0;
}

/**
 * Το `report` + `main` μιας πύλης από τη ΔΗΛΩΣΗ της — ΕΝΑ σημείο για κατάστιχο, παράκαμψη, ετυμηγορία και **είσοδο**
 * (ADR-924: το `main` κρίνει την όψη του commit όταν τη ζητά ο εκτελεστής). `report` = `{ title, blocking, healthy, width,
 * remedy }` ή δική της συνάρτηση `(result, log)` όταν το κατάστιχο λέει κάτι παραπάνω.
 */
function gateEntry({ check, skipEnv, ok, projectRoot, measure, report }) {
  const print = typeof report === 'function' ? report : (result, log = console.log) => printReport(result, report, log);
  const main = () => runGate({ check, skipEnv, ok, run: () => print(measure({ input: commitInput(projectRoot) })) });
  return { report: print, main };
}

/**
 * Μια πύλη μητρώου από τη ΔΗΛΩΣΗ της: `{ ...gate (βλ. measureGate), check, skipEnv, ok, report: { title, blocking,
 * healthy, width, remedy } }` ⇒ `{ measure, report, main }` — ό,τι εξάγει κάθε πύλη στο self-test της.
 */
function defineRegistryGate(spec) {
  const measure = (opts = {}) => measureGate(opts, spec);
  return { measure, ...gateEntry({ ...spec, measure }) };
}

/**
 * Μια πύλη «προφίλτρο + κρίση ανά αρχείο + καλωδίωση» (3.88 · 3.89 · 3.102 · 3.106) από τη ΔΗΛΩΣΗ της:
 * `{ projectRoot, relevant: RegExp, findingsIn(sf, rel), wiringFindings(root, input), states, check, skipEnv, ok, report }`
 * ⇒ `{ measure, report, main }`. `measure({ skipWiring })` παραλείπει την καλωδίωση (fixtures του self-test).
 */
function defineScanGate(spec) {
  const measure = (opts = {}) => {
    const scope = scanScope(opts, spec.projectRoot);
    const findings = [];
    forEachRelevant(scope, spec.relevant, (abs, rel, text) => findings.push(...spec.findingsIn(sourceFileOf(abs, text), rel)));
    findings.push(...(opts.skipWiring ? [] : spec.wiringFindings(scope.root, scope.input)));
    return { findings, tally: tallyOf(findings, spec.states), examined: scope.files.length };
  };
  return { measure, ...gateEntry({ ...spec, measure }) };
}

module.exports = {
  defineRegistryGate, defineScanGate, gateEntry, measureGate, printReport, printFindingsReport, runGate,
  scanScope, forEachRelevant, tallyOf, commitInput,
};
