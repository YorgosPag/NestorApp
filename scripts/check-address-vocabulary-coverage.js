#!/usr/bin/env node
/**
 * CHECK 3.44 / ADR-772 §9 — **η πύλη του λεξιλογίου διευθύνσεων**.
 *
 * ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΔΕΝ ΑΠΑΝΤΟΥΣΕ ΚΑΝΕΙΣ:
 *   «Ένα δοχείο διεύθυνσης απέκτησε πεδίο διοικητικής ιεραρχίας **χωρίς γραμμή στον
 *   πίνακα**;»  Τότε ο μετατροπέας δεν το μεταφέρει, **τίποτα δεν σκάει**, και είμαστε
 *   πίσω στην ίδια σιωπηλή απώλεια που έλυσε το ADR-772 — με τη διαφορά ότι πλέον θα
 *   **φαίνεται λυμένη**. Η αρχική μέτρηση: `BuildingAddressesEditor` μετέφερε **5 από 8**
 *   επίπεδα, `FrontageAddressCreateDialog` **2 από 8**, και οι **8** ταυτότητες πετιόνταν
 *   ολόκληρες — όλα με κάθε πύλη πράσινη.
 *
 * 🔴 ΓΙΑΤΙ ΚΑΜΙΑ ΥΠΑΡΧΟΥΣΑ ΠΥΛΗ ΔΕΝ ΤΟ ΒΛΕΠΕΙ:
 *   · ο **μεταγλωττιστής** πιάνει ένατο επίπεδο, μετονομασία πεδίου και ξεχασμένο Zod
 *     (ADR-772 §9· γι' αυτό εδώ υπάρχουν **δύο** καταστάσεις παράβασης, όχι εννιά)·
 *   · το **CHECK 3.7** φρουρεί τα *ιδιωτικά ζεύγη μετατροπέα*, όχι τα **πεδία**·
 *   · το **CHECK 3.18** σαρώνει `src/config|utils|lib` σε `-maxdepth 1` — τα δοχεία ζουν
 *     στο `src/types/**`, που **δεν το ανοίγει ποτέ**·
 *   · κανένα gate δεν διαβάζει τον πίνακα, άρα κανένα δεν ξέρει τι *λείπει* από αυτόν.
 *
 * ΔΥΟ ΣΤΡΩΜΑΤΑ, ΜΕ ΔΗΛΩΜΕΝΟ ΟΡΙΟ:
 *   **Στρώμα 1** (pre-commit, προεπιλογή): μόνο τα **δοχεία του πίνακα** (~6 αρχεία).
 *     Η σκανδάλη είναι **παραγόμενη**, όχι χειρόγραφη: η πύλη λύνει μόνη της ποια αρχεία
 *     είναι τα δοχεία και συγκρίνει με τα staged. Χειρόγραφη λίστα εδώ θα ήταν το σχήμα
 *     των **δύο** λιστών namespace του CHECK 3.34 — που απέκλιναν κατά 63 χωρίς κανείς
 *     να τις συγκρίνει.
 *     ⚠️ **ΔΕΝ βλέπει** νέο τύπο αλλού στο `src/` που έγινε έκτο λεξιλόγιο. Δηλωμένο.
 *   **Στρώμα 2** (`--all`, CI): + σάρωση **όλου** του `src/`.
 *
 * ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ:
 *   1. **ZERO TOLERANCE** — `unmapped-administrative-field` + `unanalyzable-container`.
 *      Μετρημένα **0** σήμερα (2026-08-08) και **δομικά ανεπίδεκτα απορρόφησης**: το
 *      `buildPayload` **αρνείται** να γράψει baseline που τα περιέχει. Ένα zero-tol που
 *      μπορεί να κλειδωθεί με ένα `--write-baseline` δεν είναι zero-tol.
 *   2. **RATCHET κατά ταυτότητα** — `unregistered-vocabulary` (μετρημένα 4). Ratchet και
 *      όχι zero-tol επειδή και τα τέσσερα είναι **πραγματικά** και η θεραπεία τους είναι
 *      **μετανάστευση τομέα** (νέα στήλη στον πίνακα ⇒ αλλαγή σε 5 δοχεία), που το
 *      ADR-772 §6 αφήνει ρητά έξω από αυτή τη δουλειά.
 *
 * ⚠️ ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΔΕΥΤΕΡΟ «ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ» (όπως στο CHECK 3.39): εκεί κάθε **νέα**
 * δήλωση σταθερού hex είναι δομικά επικίνδυνη ακόμη κι όταν σήμερα περνά. Εδώ μια **νέα
 * χαρτογραφημένη** διοικητική στήλη είναι ακριβώς η **σωστή** πράξη — κλειστό σύνολο θα
 * μπλόκαρε τη θεραπεία. Ένα σύνολο, γραμμένο ρητά.
 *
 * ⚠️ ΤΟ ΠΛΗΘΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ. Μετρά «λεξιλόγια που ο πίνακας δεν ξέρει».
 * **Άνοιξε τη baseline πριν επικαλεστείς αριθμό.**
 *
 * ⚠️ Η σύγκρουση `community`/`neighborhood` (ADR-772 §5) είναι **απόφαση τομέα, ανοιχτή
 * κατ' απόφαση**. Η σωστή συμπεριφορά αυτής της πύλης: αν κάποιος προσθέσει `communityId`
 * στο `ProjectAddress`, να **μπλοκάρει** και να δείξει το §5 — όχι να «διορθώσει».
 *
 * CLI:
 *   node scripts/check-address-vocabulary-coverage.js <staged…>   # Στρώμα 1
 *   node scripts/check-address-vocabulary-coverage.js --all       # Στρώμα 2 (CI)
 *   node scripts/check-address-vocabulary-coverage.js --all --report
 *   node scripts/check-address-vocabulary-coverage.js --all --write-baseline
 *
 * Env: SKIP_ADDRESS_VOCABULARY=1 · ADDRESS_VOCABULARY_BASELINE_FILE
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PROJECT_ROOT, runSetRatchetCli } = require('./lib/ratchet-baseline');
const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const { readVocabularyTable, VOCABULARY_FILE } = require('./lib/address-vocabulary/vocabulary-table');
const { createResolver, resolveContainerDeclarations } = require('./lib/address-vocabulary/type-index');
const {
  evaluateContainers, evaluateTree,
  ZERO_TOLERANCE_STATES, RATCHETED_STATES, VIOLATION_STATES,
} = require('./lib/address-vocabulary/evaluate');

const LIB_DIR = 'scripts/lib/address-vocabulary';
const SELF = 'scripts/check-address-vocabulary-coverage.js';

const toRel = (root, p) => path.relative(root, p).replace(/\\/g, '/');

function baselineFile() {
  return process.env.ADDRESS_VOCABULARY_BASELINE_FILE
    || path.join(PROJECT_ROOT, '.address-vocabulary-baseline.json');
}

/**
 * Τα αρχεία που **ορίζουν** την απάντηση του Στρώματος 1 — παραγόμενα από τον πίνακα,
 * ποτέ γραμμένα με το χέρι: ο πίνακας, κάθε αρχείο δήλωσης δοχείου, κάθε αρχείο βάσης
 * τους, και ο κώδικας της ίδιας της πύλης.
 */
function layer1Inputs(table, resolver, root = PROJECT_ROOT) {
  const files = new Set([VOCABULARY_FILE, SELF]);
  const libDir = path.join(root, LIB_DIR);
  if (fs.existsSync(libDir)) for (const name of fs.readdirSync(libDir)) files.add(`${LIB_DIR}/${name}`);
  for (const { decl, heritage } of resolveContainerDeclarations(table, resolver)) {
    if (!decl) continue;
    files.add(decl.file);
    for (const key of heritage) files.add(key.split('::')[0]);
  }
  return files;
}

/** `file::Name` των δοχείων και των βάσεών τους — για να μην κριθούν δεύτερη φορά. */
function registeredAndBaseKeys(table, resolver) {
  const registered = new Set();
  const bases = new Set();
  for (const { decl, heritage } of resolveContainerDeclarations(table, resolver)) {
    if (!decl) continue;
    registered.add(`${decl.file}::${decl.name}`);
    for (const key of heritage) bases.add(key);
  }
  return { registered, bases };
}

/**
 * Κάθε δήλωση τύπου-αντικειμένου του δέντρου.
 *
 * ⚠️ **ΧΩΡΙΣ ΠΡΟΦΙΛΤΡΟ ΚΕΙΜΕΝΟΥ, ΕΠΙΤΗΔΕΣ.** Το προφανές («διάβασε μόνο αρχεία που
 * αναφέρουν ρίζα επιπέδου») είναι **ΑΣΘΕΝΕΣ**: το `DerivedWorkAddress` παίρνει και τα
 * δέκα διοικητικά πεδία του από `extends IndividualAddress`, δηλαδή από **άλλο αρχείο**.
 * Ένα αρχείο μπορεί να μη γράφει ποτέ τη λέξη «region» και να δηλώνει λεξιλόγιο.
 * Κόστος της ορθότητας: 28s αντί 7s — **μόνο στο CI**, όπου το `--all` του CHECK 3.35
 * είναι ~2 λεπτά για σύγκριση.
 */
function allDeclarations(resolver, root = PROJECT_ROOT) {
  const out = [];
  for (const abs of collectSourceFiles(root, ['src'])) {
    const parsed = resolver.load(toRel(root, abs));
    if (!parsed) continue;
    for (const decl of parsed.declarations.values()) out.push(decl);
  }
  return out;
}

function measure(args = [], root = PROJECT_ROOT) {
  const scope = args.includes('--all') ? 'all' : 'layer1';
  const table = readVocabularyTable(root);
  const resolver = createResolver(root);

  const container = evaluateContainers(table, resolver);
  const findings = [...container.findings];
  const byState = {};
  for (const f of container.findings) byState[f.state] = (byState[f.state] || 0) + 1;
  let declarationCount = 0;

  if (scope === 'all') {
    const { registered, bases } = registeredAndBaseKeys(table, resolver);
    const declarations = allDeclarations(resolver, root);
    declarationCount = declarations.length;
    const tree = evaluateTree(declarations, table, resolver, registered, bases);
    findings.push(...tree.findings);
    for (const [k, n] of Object.entries(tree.byState)) byState[k] = (byState[k] || 0) + n;
  }

  const violations = findings.filter((f) => VIOLATION_STATES.includes(f.state));
  return {
    scope,
    table,
    findings,
    byState,
    judgedContainerFields: container.judged,
    declarationCount,
    violations,
    violationIds: violations.map(violationId).sort(),
    // Ένα σύνολο, όχι δύο — ο λόγος είναι γραμμένος στην επικεφαλίδα του αρχείου.
    declarations: [],
  };
}

/** Ταυτότητα = κατάσταση + λογικό αναγνωριστικό. **Χωρίς γραμμή**: μετακινείται. */
function violationId(f) {
  return `${f.state}::${f.id}`;
}

/**
 * ⚠️ Η baseline **αρνείται** να απορροφήσει zero-tolerance εύρημα. Χωρίς αυτό, ένα
 * `--write-baseline` θα μετέτρεπε σιωπηλά την απάντηση του §2.1 σε «αποδεκτό χρέος» —
 * δηλαδή θα ξανάφτιαχνε ακριβώς τη σιωπή που η πύλη υπάρχει για να σπάσει.
 */
function buildPayload(m) {
  if (m.scope !== 'all') {
    throw new Error('η baseline γράφεται μόνο από πλήρη σάρωση — πρόσθεσε `--all`.');
  }
  const blocked = m.violations.filter((f) => ZERO_TOLERANCE_STATES.includes(f.state));
  if (blocked.length) {
    throw new Error(
      `αρνούμαι να κλειδώσω ${blocked.length} εύρημα/-τα μηδενικής ανοχής:\n`
      + blocked.map((f) => `        · [${f.state}] ${f.file}:${f.line} — ${f.detail}`).join('\n')
      + '\n        Διόρθωσε τον πίνακα (ADMIN_LEVEL_VOCABULARY) ή το δοχείο. Δεν μπαίνουν σε baseline.',
    );
  }
  return {
    adr: 'ADR-772 §9 (CHECK 3.44)',
    generated_from: [VOCABULARY_FILE, 'src/**/*.ts(x)'],
    note:
      'ΔΕΝ είναι δείκτης υγείας: μετρά τύπους που μιλούν τη διοικητική ιεραρχία χωρίς να '
      + 'είναι στήλη του VocabularyContainers. Η θεραπεία είναι στήλη στον πίνακα (αλλαγή '
      + 'τομέα, ADR-772 §5/§6), όχι μικρότερος αριθμός. Τα zero-tolerance ευρήματα ΔΕΝ '
      + 'μπαίνουν ποτέ εδώ — το buildPayload τα απορρίπτει.',
    zero_tolerance_states: ZERO_TOLERANCE_STATES,
    ratcheted_states: RATCHETED_STATES,
    violation_count: m.violationIds.length,
    by_state: m.byState,
    violations: m.violationIds,
    declarations: [],
  };
}

function printReport(m) {
  console.log(`CHECK 3.44 — λεξιλόγιο διευθύνσεων (${VOCABULARY_FILE})\n`);
  console.log(`  εμβέλεια: ${m.scope === 'all' ? 'ΟΛΟ το src/' : 'μόνο τα δοχεία του πίνακα (Στρώμα 1)'}`);
  console.log(`  επίπεδα: ${m.table.levelRoots.length}   δοχεία: ${m.table.containers.length}`
    + `   κελιά πίνακα: ${m.table.rows.length}`);
  console.log(`  διοικητικά πεδία δοχείων που κρίθηκαν: ${m.judgedContainerFields}`);
  if (m.scope === 'all') console.log(`  δηλώσεις τύπων στο δέντρο: ${m.declarationCount}`);
  console.log('\n  ανά κατάσταση:');
  for (const [state, n] of Object.entries(m.byState).sort()) {
    const mark = ZERO_TOLERANCE_STATES.includes(state) ? '⛔'
      : RATCHETED_STATES.includes(state) ? '🔴' : '✅';
    console.log(`    ${mark} ${state.padEnd(30)} ${n}`);
  }
  console.log('\n  ευρήματα αναλυτικά:');
  for (const f of m.findings) {
    if (!VIOLATION_STATES.includes(f.state) && f.state !== 'unanalyzable-heritage') continue;
    console.log(`    [${f.state}] ${f.file}:${f.line}`);
    console.log(`       ${f.detail}`);
  }
}

const DESCRIPTOR = {
  adr: 'CHECK 3.44',
  skipEnv: 'SKIP_ADDRESS_VOCABULARY',
  get baselineFile() { return baselineFile(); },
  measure,
  buildPayload,
  printReport,
  violationId,
  labels: { violations: 'αδήλωτα λεξιλόγια', declarations: 'κλειστά σύνολα (κανένα εδώ)' },
  messages: {
    worse: 'το λεξιλόγιο διευθύνσεων απέκτησε αδήλωτο πεδίο ή αδήλωτο δοχείο',
    newDeclLabel: '—',
    newDeclAdvice: [],
  },
  commands: {
    report: 'npm run address-vocabulary:report',
    baseline: 'npm run address-vocabulary:baseline',
    seed: 'node scripts/check-address-vocabulary-coverage.js --all --write-baseline',
  },
};

/**
 * Το Στρώμα 1 **δεν αγγίζει τη baseline**: έχει δει μόνο τα δοχεία, οπότε η απουσία
 * ενός `unregistered-vocabulary` σημαίνει «δεν το σάρωσα», **ΟΧΙ** «καθαρίστηκε». Μια
 * σύγκριση συνόλων εδώ θα ανέφερε τα 4 υπαρκτά ως **πρόοδο** και θα καλούσε σε reseed
 * — το ακριβές μάθημα `scope: 'staged'` του CHECK 3.38.
 */
function runLayer1(argv, root = PROJECT_ROOT) {
  const staged = argv.slice(2).filter((a) => !a.startsWith('--')).map((f) => f.replace(/\\/g, '/'));
  const table = readVocabularyTable(root);
  const resolver = createResolver(root);
  const inputs = layer1Inputs(table, resolver, root);
  const touched = staged.filter((f) => inputs.has(f));

  if (staged.length && touched.length === 0) {
    console.log('✅ CHECK 3.44 — κανένα δοχείο διεύθυνσης στα staged αρχεία.');
    return 0;
  }

  const m = measure([], root);
  if (m.violations.length === 0) {
    console.log(`✅ CHECK 3.44 (ADR-772 §9) — ${m.judgedContainerFields} διοικητικά πεδία, `
      + `όλα με γραμμή στον πίνακα (${touched.length || inputs.size} αρχεία).`);
    return 0;
  }

  console.error('⛔ CHECK 3.44 (ADR-772 §9) — αδήλωτο πεδίο διοικητικής ιεραρχίας\n');
  for (const f of m.violations) {
    console.error(`   🚫 ${f.file}:${f.line}  [${f.state}]`);
    console.error(`      ${f.detail}`);
  }
  console.error(`\n   Πρόσθεσε γραμμή στο ADMIN_LEVEL_VOCABULARY του ${VOCABULARY_FILE},`);
  console.error('   ή δήλωσε ρητά `NOT_STORED` αν το δοχείο πράγματι δεν το κρατά.');
  console.error('   ⚠️ Αν το πεδίο είναι `communityId` σε ProjectAddress: ΜΗΝ το χαρτογραφήσεις —');
  console.error('      είναι η ανοιχτή σύγκρουση του ADR-772 §5 (απόφαση τομέα, όχι τεχνική).');
  console.error(`\n   Αναφορά: ${DESCRIPTOR.commands.report}`);
  console.error('   Έμμεση διαφυγή (αιτιολόγησε στον Giorgio): SKIP_ADDRESS_VOCABULARY=1');
  return 1;
}

async function main(argv = process.argv) {
  if (process.env.SKIP_ADDRESS_VOCABULARY) return process.exit(0);
  if (!argv.slice(2).includes('--all')) return process.exit(runLayer1(argv));
  return runSetRatchetCli(DESCRIPTOR, argv);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`❌ CHECK 3.44 — ${e.message}`);
    process.exit(1);
  });
}

module.exports = {
  measure, buildPayload, printReport, violationId, baselineFile,
  layer1Inputs, registeredAndBaseKeys, allDeclarations, runLayer1, main, DESCRIPTOR,
};
