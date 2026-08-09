#!/usr/bin/env node
/**
 * CHECK 3.50 (ADR-780) — Η ΠΥΛΗ ΤΗΣ ΚΛΙΜΑΚΑΣ z-index.
 *
 * ΤΟ ΕΡΩΤΗΜΑ: «κάθε επιφάνεια που δηλώνει **καθολική** στρώση, τη ζητά από τη **ΜΙΑ**
 * κλίμακα;» — και, το ίδιο σημαντικό: «το token που ζητά **υπάρχει**;».
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (μετρημένο 2026-08-08, ζωντανά + με grep)
 * ───────────────────────────────────────────────────────────────────────────────
 * Το SSoT σταματούσε στο `tooltip: 1800`. Πάνω από αυτό βρέθηκαν **πέντε** λεξιλόγια:
 *   1. `design-tokens.json` → `--z-index-*`            η αυθεντία
 *   2. `design-tokens/modules/layout.ts`               ΧΕΙΡΟΓΡΑΦΟΣ καθρέφτης («Synced with…»)
 *   3. `layout-utilities-constants.ts` `zIndex`        modal **1000** · tooltip **2000**  (νεκρό)
 *   4. `dxf-viewer/theme/tokens.color.css` `--cp-z-*`  modal **9999** · tooltip **10000** (νεκρό)
 *   5. `ribbon-tokens.css` `--ribbon-z-context-menu`   1100 (ζωντανό)
 * Τα (3) και (4) δίνουν **ΔΙΑΦΟΡΕΤΙΚΟ ΑΡΙΘΜΟ ΣΤΟ ΙΔΙΟ ΟΝΟΜΑ ΡΟΛΟΥ** — χειρότερο σχήμα
 * από το ADR-749 («δύο αλήθειες, η μία ανώνυμη»): εδώ και οι δύο έχουν **όνομα** και
 * διαφωνούν. Το (2) δεν το επέβαλλε **καμία** πύλη· ήταν ανάθεση σε άνθρωπο, ακριβώς
 * όπως οι δύο λίστες namespace του CHECK 3.34 που είχαν **αποκλίνει κατά 63**.
 *
 * ⚠️ ΜΗΝ ΔΙΑΒΑΣΕΙΣ ΤΟΝ ΑΡΙΘΜΟ ΤΗΣ BASELINE ΩΣ ΔΕΙΚΤΗ ΥΓΕΙΑΣ. Μετρά «όσα σημεία δεν
 * ζητούν ακόμη από την κλίμακα», όχι «πόσο σπασμένη είναι η στρώση». Η θεραπεία είναι
 * **ρόλοι** (`var(--z-index-viewer-menu)`), όχι μικρότερος αριθμός — ένα bump από 9999
 * σε 9998 θα μείωνε τον αριθμό και δεν θα διόρθωνε τίποτα.
 *
 * ⚠️ ΜΗΝ ΤΟ ΚΑΝΕΙΣ ZERO-TOLERANCE. Οι ωμές δηλώσεις είναι δεκάδες σε **ζωντανό** κώδικα
 * που δουλεύει· zero-tol θα ήταν μονίμως κόκκινο, άρα θα παρακαμπτόταν με `SKIP_` και η
 * πύλη θα γινόταν διακοσμητική (το μάθημα του CHECK 3.39: δοκιμάστηκε, απορρίφθηκε).
 * Οι **δύο** καταστάσεις που ΕΙΝΑΙ zero-tolerance (`unknown-token`, `parallel-scale`)
 * δεν μπαίνουν **ΠΟΤΕ** σε baseline — δες `buildPayload`.
 *
 * ⚠️ ΜΗΝ ΠΡΟΣΘΕΣΕΙΣ stylelint. Το CHECK 3.43 το απέρριψε γραπτώς και ο λόγος ισχύει
 * ακέραιος εδώ: ο κανόνας `no-unknown-custom-properties` τεκμηριώνει **κατά λέξη** ότι
 * ένα fallback κάνει τη χρήση αποδεκτή — δηλαδή θα έλεγε «καθαρό» ακριβώς εκεί που
 * ρωτάμε. Δεύτερη μηχανή lint που απαντά «καθαρό» είναι το σχήμα ADR-749.
 *
 * Εκτέλεση:  node scripts/check-zindex-scale.js            (πύλη)
 *            node scripts/check-zindex-scale.js --report   (απογραφή)
 *            node scripts/check-zindex-scale.js --write-baseline
 * Διαφυγή:   SKIP_ZINDEX_SCALE=1
 */

'use strict';

const path = require('path');

const { runSetRatchetCli, PROJECT_ROOT } = require('./lib/ratchet-baseline');
const {
  readScale, findScaleDisorder, orderIdentities, GLOBAL_LAYER_FLOOR,
} = require('./lib/zindex/scale');
const {
  STATES, ZERO_TOLERANCE, RATCHETED, scanAll, findSymbolsInSrc, listCssFiles,
} = require('./lib/zindex/sites');
const {
  FOREIGN_STATES, FOREIGN_ZERO_TOLERANCE, evaluateForeign, REGISTRY_FILE,
} = require('./lib/zindex/foreign');

const CHECK = 'CHECK 3.50';
const ADR = 'ADR-780';
const BASELINE = path.join(PROJECT_ROOT, '.zindex-scale-baseline.json');

/** Ταυτότητα παράβασης: **αρχείο + ρόλος του σφάλματος**, ποτέ ο αριθμός γραμμής μόνος. */
const violationId = (v) => `${v.file}|${v.state}|${v.raw}`;

/**
 * Τρέχει η απογραφή του `node_modules`; **Προεπιλογή: ναι** — fail-closed. Μόνο η
 * σκανδάλη του Layer 1 τη σβήνει, και τότε η αναφορά το **δηλώνει ρητά**.
 */
let foreignCensusRequested = true;

/**
 * ⛔ Οι zero-tolerance μπλοκάρουν **πριν** μπει στο παιχνίδι η baseline, και δεν
 * γράφονται ποτέ σε αυτήν. *Ένα zero-tol που κλειδώνεται με ένα `--write-baseline` δεν
 * είναι zero-tol* (το μάθημα του CHECK 3.44).
 */
function partition(found) {
  const zero = found.filter((f) => ZERO_TOLERANCE.includes(f.state));
  const ratcheted = found.filter((f) => RATCHETED.includes(f.state));
  return { zero, ratcheted };
}

/**
 * ⚠️ ΤΟ `--report` ΔΕΝ ΠΕΤΑΕΙ ΣΤΙΣ ΜΗΔΕΝΙΚΗΣ ΑΝΟΧΗΣ, ΚΑΙ ΕΙΝΑΙ ΣΚΟΠΙΜΟ. Η αναφορά είναι
 * το **διαγνωστικό** εργαλείο· το χρειάζεσαι ακριβώς **όταν** η πύλη είναι κόκκινη. Μια
 * πρώτη γραφή πετούσε πάντα, οπότε το `--report` ήταν άχρηστο στη μόνη στιγμή που έχει
 * νόημα. Η αναφορά τις τυπώνει **πρώτες και με ⛔** — δεν τις σιωπά.
 *
 * 🔑 ΤΟ `repoRoot` ΥΠΑΡΧΕΙ ΓΙΑ ΤΙΣ ΜΕΤΑΛΛΑΞΕΙΣ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ. Η σουίτα
 * αντιγράφει τα **πραγματικά** αρχεία σε μίνι-repo και αλλάζει **μία** γραμμή — δηλαδή
 * κάνει ό,τι θα έκανε ένας άνθρωπος αύριο. Μετάλλαξη στον κώδικα της **πύλης** θα
 * απεδείκνυε μόνο ότι ο κώδικας εκτελείται· μετάλλαξη στην **είσοδο** αποδεικνύει ότι η
 * πύλη απαντά το ερώτημα. Κανένας άλλος καταναλωτής δεν περνά δεύτερο όρισμα.
 */
/**
 * Το **δεύτερο κατάστιχο**: το σύνορο των τρίτων (ADR-780 Φάση Β).
 *
 * 🔑 ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΝΕΑ ΠΥΛΗ: είναι το **ίδιο ερώτημα** μία στάθμη πιο έξω — «ζητά
 * κάθε καθολική στρώση από τη ΜΙΑ κλίμακα;». Ξεχωριστή πύλη θα σήμαινε νέο workflow, νέα
 * εγγραφή στο `.ci-gate-tiers.json` και δεύτερος αριθμός για την ίδια αλήθεια. Το ADR-780
 * γεννήθηκε ακριβώς από «δύο απαντήσεις σε ένα ερώτημα».
 *
 * Η απογραφή του `node_modules` (~6s) τρέχει όταν αλλάζουν **οι εξαρτήσεις ή το ίδιο το
 * σύνορο** — τα μόνα γεγονότα που μπορούν να τη μεταβάλουν — και **άνευ όρων** στο CI.
 */
function measureForeign(repoRoot, withCensus) {
  return evaluateForeign(repoRoot, readScale(repoRoot), { findSymbolsInSrc, listCssFiles }, { withCensus });
}

async function measure(args = [], repoRoot = PROJECT_ROOT) {
  const reporting = args.includes('--report');
  const roles = readScale(repoRoot);
  const disorder = findScaleDisorder(roles);
  const { found, census } = scanAll(repoRoot, roles);
  const { zero, ratcheted } = partition(found);
  const foreign = measureForeign(repoRoot, foreignCensusRequested);
  const foreignZero = foreign.findings.filter((f) => FOREIGN_ZERO_TOLERANCE.includes(f.state));

  if (disorder.length && !reporting) {
    const lines = disorder.map((d) => `      • ${d.detail}`).join('\n');
    throw new Error(`η ίδια η κλίμακα δεν είναι διατεταγμένη:\n${lines}`);
  }
  if (zero.length && !reporting) {
    const lines = zero.map((z) => `      • ${z.file}:${z.line}  [${z.state}]  ${z.detail}`).join('\n');
    throw new Error(
      `${zero.length} παραβίαση(εις) μηδενικής ανοχής — ΔΕΝ μπαίνουν σε baseline:\n${lines}`,
    );
  }
  if (foreignZero.length && !reporting) {
    const lines = foreignZero.map((f) => `      • ${f.pkg}  [${f.state}]  ${f.detail}`).join('\n');
    throw new Error(
      `ΤΟ ΣΥΝΟΡΟ ΤΩΝ ΤΡΙΤΩΝ — ${foreignZero.length} παραβίαση(εις) μηδενικής ανοχής `
      + `(μητρώο: ${REGISTRY_FILE}, σύνορο: ${foreign.registry.boundaryStylesheet}):\n${lines}`,
    );
  }

  return {
    roles,
    census,
    found,
    zero,
    disorder,
    foreign,
    foreignZero,
    violations: ratcheted,
    violationIds: [...new Set(ratcheted.map(violationId))],
    // Η **ΔΙΑΤΑΞΗ**, όχι οι τιμές — δες `orderIdentities` και το σχόλιο του `buildPayload`.
    declarations: orderIdentities(roles),
  };
}

function buildPayload(m) {
  return {
    description:
      `${CHECK} (${ADR}) — η κλίμακα z-index. \`violations\` = ΕΝΑ αναγνωριστικό ανά (αρχείο, `
      + 'κατάσταση, ωμή τιμή) που δηλώνει καθολική στρώση χωρίς να τη ζητά από την κλίμακα. '
      + '`declarations` = η ΔΙΑΤΑΞΗ της κλίμακας (κάθε ρόλος με τον αμέσως από κάτω του και τη '
      + 'ζώνη του), ΟΧΙ οι τιμές: αναδιάταξη ή μετακίνηση πάνω/κάτω από το κατώφλι μπλοκάρει, '
      + 'ενώ μια ΜΟΝΟΤΟΝΗ επαναρίθμηση περνά πράσινη — γιατί είναι αποδεδειγμένα μηδενικής '
      + 'οπτικής αλλαγής (δες scripts/lib/zindex/scale.js ▸ orderIdentities). '
      + 'ΤΑ ZERO-TOLERANCE (unknown-token, parallel-scale) ΔΕΝ ΜΠΑΙΝΟΥΝ ΠΟΤΕ ΕΔΩ. '
      + 'ΤΟ ΠΛΗΘΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ — δες την κεφαλίδα του scripts/check-zindex-scale.js.',
    adr: ADR,
    check: CHECK,
    global_layer_floor: GLOBAL_LAYER_FLOOR,
    by_state: m.census,
    violation_count: m.violationIds.length,
    declaration_count: m.declarations.length,
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

/** Οι κάδοι τυπώνονται **ακόμα και στο μηδέν**: ένα «0» που δεν τυπώνεται διαβάζεται ως
 *  «δεν υπάρχει τέτοιος έλεγχος» (μάθημα CHECK 3.48 Κ6). */
function printReport(m) {
  console.log(`${CHECK} / ${ADR} — η κλίμακα z-index: ζητά κάθε στρώση από τη ΜΙΑ πηγή;\n`);
  console.log(`  αυθεντία: design-tokens.json ▸ zIndex   (${m.roles.length} ρόλοι)`);
  console.log(`  κατώφλι καθολικού στρώματος: ${GLOBAL_LAYER_FLOOR}\n`);

  if (m.disorder.length) {
    console.log('  ⛔ Η ΙΔΙΑ Η ΚΛΙΜΑΚΑ ΔΕΝ ΕΙΝΑΙ ΔΙΑΤΕΤΑΓΜΕΝΗ:');
    for (const d of m.disorder) console.log(`     • ${d.detail}`);
    console.log('');
  }
  if (m.zero.length) {
    console.log(`  ⛔ ΜΗΔΕΝΙΚΗΣ ΑΝΟΧΗΣ (${m.zero.length}) — δεν μπαίνουν ΠΟΤΕ σε baseline:`);
    for (const z of m.zero) console.log(`     • ${z.file}:${z.line}  [${z.state}]  ${z.detail}`);
    console.log('');
  }

  console.log('  Η ΚΛΙΜΑΚΑ:');
  for (const r of m.roles) console.log(`    ${String(r.value).padStart(10)}  ${r.role}`);

  console.log('\n  ΑΠΟΓΡΑΦΗ (κλειστή — κάθε σημείο σε ακριβώς μία κατάσταση):');
  const mark = (s) => (ZERO_TOLERANCE.includes(s) ? '⛔' : RATCHETED.includes(s) ? '🔴' : '✅');
  for (const state of Object.values(STATES)) {
    console.log(`    ${mark(state)} ${state.padEnd(18)} ${String(m.census[state]).padStart(5)}`);
  }
  const total = Object.values(m.census).reduce((a, b) => a + b, 0);
  console.log(`       ${'ΣΥΝΟΛΟ'.padEnd(19)} ${String(total).padStart(5)}`);

  const byFile = new Map();
  for (const v of m.violations) byFile.set(v.file, (byFile.get(v.file) || 0) + 1);
  console.log(`\n  ΩΜΕΣ ΔΗΛΩΣΕΙΣ ανά αρχείο (${byFile.size} αρχεία):`);
  for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(3)}  ${file}`);
  }
  printForeignReport(m.foreign);
  console.log('\n  Θεραπεία: ΡΟΛΟΣ, όχι μικρότερος αριθμός — var(--z-index-<ρόλος>).');
}

/**
 * ⚠️ ΟΤΑΝ Η ΑΠΟΓΡΑΦΗ ΔΕΝ ΕΤΡΕΞΕ, ΤΟ ΛΕΜΕ ΠΡΩΤΑ ΚΑΙ ΜΕ ⏭. Οι τρεις καταστάσεις που τη
 * χρειάζονται θα τυπώνονταν αλλιώς «0», δηλαδή «κανείς δεν κοίταξε» ντυμένο ως «καθαρό».
 */
function printForeignReport(foreign) {
  console.log(`\n  ΤΟ ΣΥΝΟΡΟ ΤΩΝ ΤΡΙΤΩΝ (${REGISTRY_FILE} → ${foreign.registry.boundaryStylesheet}):`);
  if (!foreign.censusRan) {
    console.log('    ⏭️  Η ΑΠΟΓΡΑΦΗ ΤΟΥ node_modules ΔΕΝ ΕΤΡΕΞΕ — οι καταστάσεις undeclared/');
    console.log('        drifted/orphan-declaration ΔΕΝ τέθηκαν. Τρέχει άνευ όρων στο CI (--all).');
  }
  const mark = (s) => (FOREIGN_ZERO_TOLERANCE.includes(s) ? '⛔' : '✅');
  for (const state of Object.values(FOREIGN_STATES)) {
    console.log(`    ${mark(state)} ${state.padEnd(28)} ${String(foreign.census[state]).padStart(3)}`);
  }
  const total = Object.values(foreign.census).reduce((a, b) => a + b, 0);
  console.log(`       ${'ΣΥΝΟΛΟ'.padEnd(29)} ${String(total).padStart(3)}`);
  for (const f of foreign.findings) {
    console.log(`      ${String(f.observed).padStart(10)}  ${f.pkg.padEnd(24)} ${f.state}`);
  }
}

const DESCRIPTOR = {
  adr: CHECK,
  skipEnv: 'SKIP_ZINDEX_SCALE',
  baselineFile: BASELINE,
  measure,
  buildPayload,
  printReport,
  violationId,
  labels: { violations: 'ωμές δηλώσεις στρώσης', declarations: 'σκαλιά διάταξης' },
  messages: {
    worse: 'μια επιφάνεια δηλώνει καθολική στρώση χωρίς να τη ζητά από την κλίμακα',
    newDeclLabel: 'ΔΙΑΤΑΞΗ ΚΛΙΜΑΚΑΣ:',
    newDeclAdvice: [
      'Η ΣΕΙΡΑ των ρόλων άλλαξε στο design-tokens.json ▸ zIndex (νέος ρόλος, αναδιάταξη,',
      'ή μετακίνηση πάνω/κάτω από το κατώφλι καθολικού στρώματος).',
      'ΜΟΝΟΤΟΝΗ επαναρίθμηση ΔΕΝ φτάνει ποτέ εδώ: η διάταξη μένει ίδια, άρα καμία επιφάνεια',
      'δεν μετακινείται σε σχέση με καμία άλλη — η πύλη το αποδεικνύει, δεν το εμπιστεύεται.',
      'Αν φτάσεις εδώ, ΚΑΤΙ ΑΛΛΑΞΕ ΣΤΗ ΣΧΕΤΙΚΗ ΣΕΙΡΑ. Αν είναι σκόπιμο: npm run build:tokens',
      'ΚΑΙ μετά reseed — αλλά πρώτα ονόμασε ΠΟΙΟ ζεύγος αντιστράφηκε και γιατί επιτρέπεται.',
    ],
  },
  commands: {
    seed: 'node scripts/check-zindex-scale.js --write-baseline',
    report: 'npm run zindex-scale:report',
    baseline: 'npm run zindex-scale:baseline',
  },
};

// ---------------------------------------------------------------------------
// Η ΣΚΑΝΔΑΛΗ — ζει ΕΔΩ, και όταν πυροδοτεί ο έλεγχος είναι ΠΑΝΤΑ πλήρης
// ---------------------------------------------------------------------------

/**
 * Τα αρχεία που είναι **αυθεντία** της κλίμακας: αγγίζονται ⇒ έλεγχος, χωρίς ερώτηση.
 * Το `variables.css` ΔΕΝ χρειάζεται να απαριθμηθεί — περιέχει `z-index` και το πιάνει
 * το προφίλτρο κειμένου παρακάτω.
 */
const AUTHORITY_FILES = [
  'design-tokens.json',
  'scripts/check-zindex-scale.js',
  '.zindex-foreign.json',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
];
const AUTHORITY_DIRS = ['scripts/lib/zindex/'];

/**
 * Τα **μόνα** γεγονότα που μπορούν να μεταβάλουν την απογραφή του `node_modules`: αλλαγή
 * εξαρτήσεων, αλλαγή του μητρώου, αλλαγή του ίδιου του συνόρου, ή αλλαγή του κώδικα που
 * κρίνει. Οτιδήποτε άλλο αφήνει την απάντηση **αποδεδειγμένα** ίδια — γι' αυτό η
 * παράλειψη εδώ δεν είναι έκπτωση, είναι συμπέρασμα.
 *
 * ⚠️ Η ΑΛΛΑΓΗ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΠΥΛΗΣ ΕΙΝΑΙ ΣΚΑΝΔΑΛΗ (μάθημα CHECK 3.43): αλλιώς το νέο
 * κριτήριο θα έβγαινε πράσινο **πάνω στην αλλαγή του εαυτού του**.
 */
function touchesForeignCensus(files, boundaryStylesheet) {
  const census = new Set([
    'package.json', 'package-lock.json', 'pnpm-lock.yaml', '.zindex-foreign.json', boundaryStylesheet,
  ]);
  return files.some((f) => {
    const rel = f.split(path.sep).join('/');
    return census.has(rel) || rel.startsWith('scripts/lib/zindex/') || rel === 'scripts/check-zindex-scale.js';
  });
}

/** Οι τρεις διάλεκτοι σε μορφή κειμένου — ό,τι δεν τις γράφει, δεν δηλώνει στρώση. */
const LAYERING_MARKERS = ['z-index', 'zIndex', 'z-['];

/**
 * Αγγίζει κάτι από αυτά τη **στρώση**;
 *
 * 🔑 ΓΙΑΤΙ ΠΡΟΦΙΛΤΡΟ ΚΕΙΜΕΝΟΥ ΚΑΙ ΟΧΙ ΛΙΣΤΑ ΜΟΝΟΠΑΤΙΩΝ: μια ωμή `z-index: 9999` μπορεί
 * να προσγειωθεί σε **οποιοδήποτε** `.css`/`.ts`/`.tsx` του `src/` — δηλαδή ο κατάλογος
 * «πού μπορεί να συμβεί» είναι όλο το δέντρο. Λίστα φακέλων εδώ θα ήταν σωστή σήμερα και
 * θα απέκλινε σιωπηλά αύριο (το σχήμα των δύο λιστών namespace του CHECK 3.34). Το
 * προφίλτρο κοστίζει μία ανάγνωση ανά σταδιοποιημένο αρχείο (~0,05s) και **δεν** αλλάζει
 * ποτέ την απάντηση: όταν πυροδοτεί, σαρώνεται **όλο** το δέντρο.
 *
 * ⚠️ ΑΡΧΕΙΟ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ ΣΤΟΝ ΔΙΣΚΟ ⇒ ΣΧΕΤΙΚΟ (fail-open προς τον έλεγχο). Είναι
 * **διαγραφή**, και η διαγραφή ενός ορισμού `--z-index-*` κάνει αδέσποτα αρχεία που
 * κανείς δεν σταδιοποίησε — ακριβώς η κατάσταση `unknown-token`.
 */
function touchesLayering(files) {
  const fs = require('fs');
  return files.some((f) => {
    const rel = f.split(path.sep).join('/');
    if (AUTHORITY_FILES.includes(rel) || AUTHORITY_DIRS.some((d) => rel.startsWith(d))) return true;
    if (!/^src\/.*\.(css|ts|tsx)$/.test(rel)) return false;
    const full = path.join(PROJECT_ROOT, rel);
    if (!fs.existsSync(full)) return true; // διαγραφή — δες παραπάνω
    const text = fs.readFileSync(full, 'utf8');
    return LAYERING_MARKERS.some((marker) => text.includes(marker));
  });
}

/**
 * ⚠️ Η ΠΑΡΑΛΕΙΨΗ ΓΙΝΕΤΑΙ **ΠΡΙΝ** ΤΟΝ ΜΗΧΑΝΙΣΜΟ RATCHET, ΚΑΙ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ. Αν αντί
 * γι' αυτό η `measure` επέστρεφε κενό σύνολο, ο συγκριτής θα έβλεπε **37 παραβιάσεις
 * λιγότερες** και θα τύπωνε «⬇ κλείδωσέ το» — δηλαδή θα προσκαλούσε reseed της baseline
 * στο **μηδέν** επειδή κανείς δεν κοίταξε. *Απουσία δεν είναι πρόοδος* (μάθημα του
 * `scope:'staged'` στο CHECK 3.38 και της Layer 1 του CHECK 3.44).
 */
if (require.main === module) {
  const staged = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (staged.length > 0 && !touchesLayering(staged)) {
    console.log(`⏭️  ${CHECK} — καμία σταδιοποιημένη αλλαγή δηλώνει στρώση`);
    process.exit(0);
  }
  if (staged.length > 0) {
    const { boundaryStylesheet } = require('./lib/zindex/foreign').readRegistry(PROJECT_ROOT);
    foreignCensusRequested = touchesForeignCensus(staged, boundaryStylesheet);
  }
  runSetRatchetCli(DESCRIPTOR, process.argv.filter((a) => !staged.includes(a)));
}

module.exports = {
  DESCRIPTOR,
  measure,
  measureForeign,
  buildPayload,
  violationId,
  touchesLayering,
  touchesForeignCensus,
  CHECK,
  ADR,
  BASELINE,
};
