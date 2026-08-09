#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.51 (ADR-781) — ΩΜΑ i18n ΚΛΕΙΔΙΑ ΣΤΟ SSR HTML · ΣΤΑΤΙΚΟ ΜΙΣΟ (Κ1 + Κ2)
 * =============================================================================
 *
 * ΤΙ ΕΓΙΝΕ ΚΑΙ ΓΕΝΝΗΣΕ ΑΥΤΗ ΤΗΝ ΠΥΛΗ
 * -----------------------------------
 * **17 ωμά κλειδιά σε ΚΑΘΕ μία από τις 141 διαδρομές**, μόνιμα, και στην
 * παραγωγή — το πλαϊνό μενού ζει στο root layout. Ο `useTranslationLazy`
 * αρχικοποιούσε την ετοιμότητά του σε `useState(false)` και τη διόρθωνε **μόνο**
 * σε `useEffect`, που **δεν τρέχει ποτέ σε SSR**.
 *
 * 🔴 Η ΜΕΤΑΦΡΑΣΗ ΗΤΑΝ ΗΔΗ ΕΚΕΙ. Γι' αυτό **καμία** από τις πέντε πύλες i18n δεν
 * μπορούσε να το δει: όλες ρωτούν «υπάρχει το κλειδί;» και η απάντηση ήταν ναι.
 * Και η μοναδική «απόδειξη χρόνου εκτέλεσης» (`shell-slice-no-raw-keys.test.ts`)
 * έκανε `if (want.whole) continue` — παρέλειπε **ακριβώς** τα 9 namespaces όπου
 * ζούσε το `navigation`. Ήταν **πράσινη πάνω στη σπασμένη οθόνη**.
 *
 * ΤΡΕΙΣ ΚΑΝΟΝΕΣ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Η» (μάθημα CHECK 3.41)
 * ----------------------------------------------------
 *   Κ1  δομικός        — hook που παραδίδει `t` μαζί με ετοιμότητα που μόνο
 *                        `useEffect` διορθώνει            → ΕΔΩ, ⛔ zero-tol
 *   Κ2  απαντησιμότητα — κάθε σημείο κλήσης στην κλειστότητα των **layouts**
 *                        απαντιέται από το ΑΠΟΣΤΕΛΛΟΜΕΝΟ slice → ΕΔΩ, ⛔ zero-tol
 *   Χ   ο ΧΡΗΣΜΟΣ      — περιέχει ωμά κλειδιά το HTML του server;
 *                        → `check-i18n-ssr-oracle.js`, **η αυθεντία**
 *
 * Χωρισμένοι, ο καθένας θα ήταν πράσινος πάνω σε σπασμένη οθόνη: ο ένας λέει
 * «το ns υπάρχει», ο άλλος «το component το αρνείται». Ενωμένοι με «ή», ο
 * θόρυβος του ενός θα έσβηνε το σήμα του άλλου.
 *
 * ΔΥΟ ΣΤΡΩΜΑΤΑ
 * ------------
 *   Layer 1 (pre-commit) — Κ1 στα σταδιοποιημένα · Κ2 από το **manifest**
 *                          (`shellFiles`), **χωρίς γράφο**. Μετρημένο **~1,5s**.
 *   Layer 2 (CI, `--all`) — Κ1 σε όλο το `src/` · Κ2 με **ανακατασκευή γράφου**
 *                          (~20s), γιατί το manifest μπορεί να είναι μπαγιάτικο
 *                          και ένα νέο layout αλλάζει την κλειστότητα.
 *
 * ⚠️ **ΔΕΝ ΕΙΝΑΙ RATCHET — ΚΑΜΙΑ BASELINE, ΠΟΤΕ.** Και οι δύο πληθυσμοί
 * μετρήθηκαν **0** (Κ1: 0 σε 14.751 αρχεία · Κ2: 0 σε 1.005 σημεία κλήσης).
 * Ένα zero-tol που είναι εφικτό **επειδή μετρήθηκε** δεν είναι ευσεβής πόθος.
 * Αν βρεθείς να γράφεις `.i18n-ssr-raw-keys-baseline.json`, έχεις πάρει λάθος
 * στροφή: το ερώτημα δεν είναι «λιγότερα ωμά κλειδιά από χθες;».
 *
 * Escape: `SKIP_I18N_SSR_RAW_KEYS=1`
 * Αναφορά: `npm run i18n-ssr:report`
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const K1 = require('./lib/i18n-ssr/readiness-ast');
const K2 = require('./lib/i18n-ssr/answerability');
const { loadConfig } = require('./lib/i18n-shell-slice/config');

const CHECK = 'CHECK 3.51 (ADR-781)';
const BS = String.fromCharCode(92);
const PROJECT_ROOT = path.join(__dirname, '..');
const POSIX_ROOT = PROJECT_ROOT.split(BS).join('/');

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

const GENERATED_DIR = path.join(PROJECT_ROOT, 'src', 'i18n', 'generated');

// ---------------------------------------------------------------------------

function readGenerated(name) {
  const file = path.join(GENERATED_DIR, name);
  if (!fs.existsSync(file)) throw new Error(`λείπει το ${name} — τρέξε: npm run generate:i18n-shell-slice`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function collectSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      acc.push(path.relative(PROJECT_ROOT, full).split(BS).join('/'));
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Η μέτρηση
// ---------------------------------------------------------------------------

function measureK1(files) {
  return files.map((relFile) => {
    const abs = path.join(PROJECT_ROOT, relFile);
    if (!fs.existsSync(abs)) return { file: relFile, state: K1.K1_STATES.NOT_A_SURFACE, findings: [] };
    return K1.classifyFile(relFile, fs.readFileSync(abs, 'utf8'));
  });
}

function measureK2({ full }) {
  const config = loadConfig(POSIX_ROOT);
  const slice = readGenerated('shell-slice.el.json');

  if (!full) {
    const manifest = readGenerated('shell-slice.manifest.json');
    const closureFiles = Object.keys(manifest.shellFiles || {});
    if (closureFiles.length === 0) {
      throw new Error('το manifest δεν έχει shellFiles — τρέξε: npm run generate:i18n-shell-slice');
    }
    return K2.measureAnswerability({ projectRoot: POSIX_ROOT, config, slice, closureFiles });
  }

  // Layer 2 — η κλειστότητα ξαναχτίζεται από τον γράφο, γιατί ένα ΝΕΟ layout
  // αλλάζει «ό,τι ζωγραφίζει πάντα» και το manifest το μαθαίνει μόνο μετά.
  const P = require('./lib/i18n-shell-slice/plan');
  const graph = P.buildModuleGraph(POSIX_ROOT);
  return K2.measureAnswerability({ projectRoot: POSIX_ROOT, config, slice, graph });
}

function measure(args) {
  const full = args.includes('--all') || args.includes('--full');
  const staged = args.filter((arg) => !arg.startsWith('--')).map((arg) => arg.split(BS).join('/'));

  const k1Files = full || staged.length === 0
    ? collectSourceFiles(path.join(PROJECT_ROOT, 'src'))
    : staged.filter((file) => /^src\/.*\.tsx?$/.test(file) && !/\.d\.ts$/.test(file));

  const k1 = measureK1(k1Files);
  const k2 = measureK2({ full });

  return {
    full,
    k1: { results: k1, census: K1.assertClosedK1(k1), scanned: k1.length },
    k2: { records: k2.records, census: K2.assertClosedK2(k2.records), files: k2.files, callSites: k2.callSites },
  };
}

// ---------------------------------------------------------------------------
// Η αναφορά — οι μπλοκάροντες κάδοι τυπώνονται **ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ**.
// Ένα «0» που δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος»
// (μάθημα CHECK 3.48 Κ6) — και σε αυτή ακριβώς την οικογένεια σφαλμάτων,
// το «0 = κανείς δεν κοίταξε» έχει ήδη εμφανιστεί οκτώ φορές.
// ---------------------------------------------------------------------------

function mark(state, blocking, gaps) {
  if (blocking.includes(state)) return '⛔';
  if (gaps.includes(state)) return '🔶';
  return '✅';
}

function printReport(measured) {
  console.log(`\n${CHECK} — ωμά i18n κλειδιά στο SSR HTML · στατικό μισό\n`);

  console.log(`  Κ1 — επιφάνειες που παραδίδουν \`t\`  ${DIM}(${measured.k1.scanned} αρχεία)${NC}`);
  for (const [state, count] of Object.entries(measured.k1.census)) {
    console.log(`    ${mark(state, K1.K1_BLOCKING, K1.K1_DECLARED_GAPS)} ${state.padEnd(36)}${String(count).padStart(6)}`);
  }
  for (const result of measured.k1.results.filter((item) => K1.K1_DECLARED_GAPS.includes(item.state))) {
    console.log(`      ${DIM}🔶 ${result.file}${NC}`);
  }

  console.log(`\n  Κ2 — απαντησιμότητα του shell  ${DIM}(${measured.k2.files} αρχεία / ${measured.k2.callSites} σημεία κλήσης)${NC}`);
  for (const [state, count] of Object.entries(measured.k2.census)) {
    console.log(`    ${mark(state, K2.K2_BLOCKING, K2.K2_DECLARED_GAPS)} ${state.padEnd(36)}${String(count).padStart(6)}`);
  }
  for (const record of measured.k2.records.filter((item) => item.state === K2.K2_STATES.POLICY_UNFALSIFIABLE)) {
    console.log(`      ${YELLOW}🔶 policy χωρίς εκτελέσιμο κατηγόρημα: ${record.file}${NC}`);
  }

  console.log(`\n  ${DIM}Ο ΧΡΗΣΜΟΣ (Χ) είναι η αυθεντία και τρέχει χωριστά: npm run i18n-ssr-oracle:report${NC}\n`);
}

function printFailure(measured) {
  console.error(`\n${RED}❌ ${CHECK} — το SSR μπορεί να βάψει ωμό κλειδί${NC}\n`);

  for (const result of measured.k1.results.filter((item) => K1.K1_BLOCKING.includes(item.state))) {
    if (result.state === K1.K1_STATES.UNPARSABLE) {
      console.error(`   🚫 ${result.file}`);
      console.error(`      [unparsable] ${result.detail || ''} — fail-closed: ανάλυτο αρχείο ΔΕΝ διαβάζεται ως καθαρό`);
      continue;
    }
    console.error(`   🚫 ${result.file}`);
    for (const finding of result.findings) {
      console.error(`      [Κ1] παραδίδει \`t\` μαζί με \`${finding.property}\` (γρ. ${finding.line}),`);
      console.error(`           που προκύπτει από το \`${finding.value}\` — σπόρος: ${finding.seed}, γράφεται ΜΟΝΟ σε i18n effect (δήλωση γρ. ${finding.declaredAt}).`);
      console.error(`           ${YELLOW}Στον server το effect ΔΕΝ τρέχει ⇒ η τιμή μένει για πάντα ο σπόρος.${NC}`);
    }
    console.error('');
    console.error('      ΘΕΡΑΠΕΙΑ — αρχικοποίησε ΣΥΓΧΡΟΝΑ, όπως το src/i18n/hooks/useTranslation.ts:');
    console.error('        const [ready, setReady] = useState(() => nsList.every(ns => isBundleComplete(lang, ns)));');
    console.error('      Το `useEffect` μένει ΜΟΝΟ για την τεμπέλικη φόρτωση όσων δεν είναι ήδη πλήρη.');
    console.error(`      Ρητή εξαίρεση (λόγος ΥΠΟΧΡΕΩΤΙΚΟΣ): ${DIM}// ssr-readiness-exempt: <γιατί>${NC}\n`);
  }

  const unanswerable = measured.k2.records.filter((item) => item.state === K2.K2_STATES.UNANSWERABLE);
  for (const record of unanswerable) {
    console.error(`   🚫 ${record.file}`);
    console.error(`      [Κ2] \`${record.key}\` — κανένα από τα υποψήφια namespaces δεν το απαντά: [${record.candidates.join(', ')}]`);
    console.error(`           ${YELLOW}Αυτό το αρχείο ζωγραφίζεται σε ΚΑΘΕ διαδρομή.${NC}`);
  }
  if (unanswerable.length > 0) {
    console.error('');
    console.error('      ΘΕΡΑΠΕΙΑ: πρόσθεσε το κλειδί στο src/i18n/locales/{el,en}/<ns>.json και μετά');
    console.error('                npm run generate:i18n-shell-slice');
    console.error('      ⚠️ Το CHECK 3.34 θα μείνει ΠΡΑΣΙΝΟ χωρίς αυτό: εκείνο ρωτά αν το artifact');
    console.error('         είναι ό,τι θα παρήγαγε ο generator, όχι αν ΑΡΚΕΙ.\n');
  }

  for (const record of measured.k2.records.filter((item) => item.state === K2.K2_STATES.UNRESOLVED_NO_POLICY)) {
    console.error(`   🚫 ${record.file}:${record.line}`);
    console.error(`      [Κ2] ανεπίλυτη δυναμική \`t()\` χωρίς εγγραφή policy: ${record.snippet}`);
    console.error('           Χαρακτήρισέ την στο .i18n-shell-slice.json → dynamicKeyPolicy (με ΠΡΑΓΜΑΤΙΚΑ prefixes/keys,');
    console.error('           όχι μόνο `reason` — κανένας μηχανισμός δεν εκτελεί ένα reason).');
  }

  console.error(`\n   Αναφορά: npm run i18n-ssr:report`);
  console.error(`   Έμμεση διαφυγή (αιτιολόγησε στον Giorgio): SKIP_I18N_SSR_RAW_KEYS=1\n`);
}

// ---------------------------------------------------------------------------

function main() {
  if (process.env.SKIP_I18N_SSR_RAW_KEYS) {
    console.log(`${DIM}  ⏭  ${CHECK} skipped (SKIP_I18N_SSR_RAW_KEYS=1)${NC}`);
    process.exit(0);
  }

  const args = process.argv.slice(2);

  let measured;
  try {
    measured = measure(args);
  } catch (error) {
    // fail-closed: ποτέ «καθαρό» χωρίς μέτρηση.
    console.error(`${RED}❌ ${CHECK} — αδύνατη η μέτρηση: ${error.message}${NC}`);
    process.exit(1);
    return;
  }

  if (args.includes('--report')) {
    printReport(measured);
    process.exit(0);
    return;
  }

  const k1Blocking = measured.k1.results.filter((item) => K1.K1_BLOCKING.includes(item.state));
  const k2Blocking = measured.k2.records.filter((item) => K2.K2_BLOCKING.includes(item.state));

  if (k1Blocking.length > 0 || k2Blocking.length > 0) {
    printFailure(measured);
    process.exit(1);
    return;
  }

  const gaps =
    measured.k1.results.filter((item) => K1.K1_DECLARED_GAPS.includes(item.state)).length +
    measured.k2.records.filter((item) => K2.K2_DECLARED_GAPS.includes(item.state)).length;

  console.log(
    `${GREEN}  ✅ ${CHECK} OK — Κ1: 0/${measured.k1.scanned} επιφάνειες με ετοιμότητα-μόνο-σε-effect · ` +
    `Κ2: 0/${measured.k2.callSites} αναπάντητα σημεία κλήσης σε ${measured.k2.files} shell modules` +
    `${gaps > 0 ? ` ${DIM}(${gaps} δηλωμένα κενά)${NC}` : ''}${NC}`
  );
  process.exit(0);
}

if (require.main === module) main();

module.exports = { measure, measureK1, measureK2, printReport, CHECK };
