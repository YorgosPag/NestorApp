/**
 * Ο κοινός σκελετός των πυλών «ΕΝΑΣ γραφέας» που κρίνουν με ΜΗΤΡΩΟ (CHECK 3.104 · 3.105).
 *
 * Κάθε τέτοια πύλη κάνει τα ίδια τρία πράγματα με άλλο αντικείμενο: σαρώνει το `src/` με προφίλτρο κειμένου και AST ανά
 * αρχείο → κρίνει τις δηλώσεις του μητρώου → τυπώνει κατάστιχο και μπλοκάρει. Εδώ ζει ΜΙΑ φορά ο σκελετός· η πύλη
 * κρατά μόνο ό,τι τη διαφοροποιεί (τι διαβάζει από ένα αρχείο, τι κρίνει, τι λέει στη θεραπεία).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-23, ADR-920 §12): η 3.105 γράφτηκε στο πρότυπο της 3.104 και το CHECK 3.28 (jscpd --diff)
 * βρήκε τα `measure`/`report`/`main` τους δίδυμα. Ο κανόνας N.18: ένα module, δύο καταναλωτές.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { collectSourceFiles } = require('../module-graph/scan-config');
const { toPosix } = require('../module-graph/resolve-specifier');
const { sourceFileOf } = require('./ast');

const TEST_FILE = /__tests__|\.test\.|\.spec\./;

/**
 * Σάρωση + κρίση, με το μητρώο της πύλης. `gate` = `{ projectRoot, loadRegistry(root), relevant(registry) → RegExp,
 * scan(sf, registry) → facts, findingsIn(rel, facts, registry), declaredFindings(root, registry, factsByFile), states }`.
 * Οι δηλώσεις κρίνονται και για αρχείο εκτός προφίλτρου (κενά facts) — ποτέ σιωπή. `opts` = `{ root, registry, codeFiles }`
 * για τα fixtures του self-test.
 */
function measureGate(opts, gate) {
  const root = opts.root || gate.projectRoot;
  const registry = opts.registry || gate.loadRegistry(root);
  const relevant = gate.relevant(registry);
  const files = (opts.codeFiles || collectSourceFiles(root, ['src'])).filter((f) => !TEST_FILE.test(f));
  if (!opts.codeFiles && files.length < 1000) throw new Error(`ΦΡΟΥΡΟΣ: μόνο ${files.length} αρχεία — η σάρωση δεν κοίταξε`);
  const findings = [];
  const factsByFile = new Map();
  for (const abs of files) {
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (!relevant.test(text)) continue;
    const rel = toPosix(path.relative(root, abs));
    const facts = gate.scan(sourceFileOf(abs, text), registry);
    factsByFile.set(rel, facts);
    findings.push(...gate.findingsIn(rel, facts, registry));
  }
  findings.push(...gate.declaredFindings(root, registry, factsByFile));
  const { states } = gate;
  const tally = Object.fromEntries(Object.values(states).map((s) => [s, findings.filter((f) => f.state === s).length]));
  return { findings, tally, examined: files.length };
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
 * Μια πύλη μητρώου από τη ΔΗΛΩΣΗ της: `{ ...gate (βλ. measureGate), check, skipEnv, ok, report: { title, blocking,
 * healthy, width, remedy } }` ⇒ `{ measure, report, main }` — ό,τι εξάγει κάθε πύλη στο self-test της.
 */
function defineRegistryGate(spec) {
  const measure = (opts = {}) => measureGate(opts, spec);
  const report = (result, log = console.log) => printReport(result, spec.report, log);
  const main = () => runGate({ check: spec.check, skipEnv: spec.skipEnv, ok: spec.ok, run: () => report(measure()) });
  return { measure, report, main };
}

module.exports = { defineRegistryGate, measureGate, printReport, runGate };
