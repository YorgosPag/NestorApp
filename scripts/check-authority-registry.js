#!/usr/bin/env node
'use strict';

/**
 * =============================================================================
 * CHECK 3.68 — Η ΠΥΛΗ ΤΗΣ ΑΡΧΗΣ ΤΗΣ ΕΞΟΥΣΙΟΔΟΤΗΣΗΣ (ADR-801 §4)
 * =============================================================================
 *
 * **«Αποφασίζει κάποιος *«επιτρέπεται;»* έξω από τον ΕΝΑ κριτή;»**
 *
 * ⚠️ **ΔΕΝ είναι το ερώτημα του CHECK 3.58.** Εκείνο ρωτά *«ποιος διαβάζει
 * αναξιόπιστο **κανάλι χώρου**;»* — **απομόνωση**. Αυτό ρωτά *«ποιος κρίνει
 * **ικανότητα**;»* — **εξουσιοδότηση**. Ένωσή τους θα ανέφερε αποτυχία
 * ικανότητας ως αποτυχία απομόνωσης (το λάθος που απέφυγε ρητά το ADR-775).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Την ημέρα που γράφτηκε ο κριτής, **20** αρχεία απαντούσαν μόνα τους στο
 * *«είναι διαχειριστής;»*, με **επτά** σταθερές ονόματι `ADMIN_ROLES` /
 * `ADMIN_GLOBAL_ROLES` που είχαν **πέντε διαφορετικά περιεχόμενα**. Δύο έκριναν
 * με **λίστα email**, η μία **μέσα στο bundle του φυλλομετρητή**.
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ.** OPA · Cedar · OpenFGA · CASL δίνουν όλοι
 * τη **μηχανή** πολιτικής· **κανένας δεν εγγυάται ότι δεν θα γεννηθεί δεύτερη**.
 * Η βιομηχανία ονομάζει το πρόβλημα *policy drift* και το πιάνει **στο runtime,
 * εκ των υστέρων** — δηλαδή *μαθαίνεις ότι έσπασε*. Εδώ το πιάνει το `git add`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΟΙ ΤΡΕΙΣ ΚΑΝΟΝΕΣ — ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή» (3.41)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Κ1 🔴 RATCHET κατά ταυτότητα — inline σύνολο ρόλων που **κρίνει**.
 *   Κ2 ⛔ ZERO-TOL — κλειστό σύνολο εξαιρέσεων, **υποχρεωτικός λόγος ≥40**.
 *   Κ3 ⛔ ZERO-TOL — **όνομα ρόλου που δεν υπάρχει σε κανένα λεξιλόγιο**.
 *
 * ⚠️ **ΓΙΑΤΙ Ο Κ1 ΕΙΝΑΙ RATCHET ΚΑΙ ΟΧΙ ZERO-TOL**: **14** ζωντανοί ⇒ zero-tol θα
 * γεννιόταν μονίμως κόκκινο ⇒ `SKIP_` ⇒ **διακοσμητική πύλη**. Δοκιμάστηκε και
 * απορρίφθηκε ρητά στο CHECK 3.39.
 *
 * ⚠️ **ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ, ΟΧΙ ΠΛΗΘΟΣ**: με αριθμό, η **ανταλλαγή** («διόρθωσα το Α,
 * πρόσθεσα αδέσποτο το Β» — 14→14) περνά αθόρυβα (ADR-749).
 *
 * ⚠️ **Ο ΑΡΙΘΜΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ** — είναι το μέτρο **εκστρατείας που
 * τελειώνει στο μηδέν** (Φάσεις 3β/3γ του ADR-801). Η θεραπεία είναι
 * `decideCapability`, όχι μικρότερο νούμερο.
 *
 * ⚠️ **ΜΗΝ λύσεις κόκκινο δηλώνοντας εξαίρεση «για να περάσει»**: το κλειστό
 * σύνολο υπάρχει για να **δει άνθρωπος**, όχι για να καταπίνει χρέος. Οι 14
 * ζουν στη baseline του Κ1 ως **ratchet**, όχι στο μητρώο ως «σωστά».
 *
 * CLI:
 *   node scripts/check-authority-registry.js            # κρίση vs baseline
 *   node scripts/check-authority-registry.js --report   # πλήρης απογραφή
 *   node scripts/check-authority-registry.js --write-baseline
 *
 * Escape: `SKIP_AUTHORITY_REGISTRY=1`
 */

const path = require('node:path');

const ratchet = require('./lib/ratchet-baseline');
const { takeInventory, REGISTRY_FILE } = require('./lib/authority-registry/inventory');
const { STATES, BLOCKING, judge, idsOf } = require('./lib/authority-registry/judge');

const ROOT = ratchet.PROJECT_ROOT;
const BASELINE_FILE = path.join(ROOT, '.authority-registry-baseline.json');

/**
 * Οι είσοδοι που **ξανακρίνουν όλο το δέντρο**: το μητρώο, τα λεξιλόγια, ο
 * κριτής, και **η ίδια η πύλη**.
 *
 * ⚠️ Χωρίς το τελευταίο, αλλαγή στο **κριτήριο** περνά **χωρίς να ασκηθεί ποτέ**
 * (μάθημα CHECK 3.43 / 3.57).
 */
const TRIGGER_FILES = [
  REGISTRY_FILE,
  '.authority-registry-baseline.json',
  'src/lib/auth/types.ts',
  'src/lib/auth/roles.ts',
  'src/lib/auth/authority.ts',
  'src/types/capability-authority.ts',
  'src/auth/hooks/useCapability.ts',
  'scripts/check-authority-registry.js',
];

/** Ο δείκτης κειμένου — ίδιος με το προφίλτρο της απογραφής. */
const ROLE_HINT = /super_admin|company_admin|internal_user|external_user/;

function triggers(stagedFiles, readFile) {
  return stagedFiles.some((f) => {
    const rel = f.split(path.sep).join('/');
    if (TRIGGER_FILES.includes(rel)) return true;
    if (rel.startsWith('scripts/lib/authority-registry/')) return true;
    if (!/^src\/.*\.tsx?$/.test(rel)) return false;
    const src = readFile(rel);
    return src !== null && ROLE_HINT.test(src);
  });
}

/**
 * ⚡ **ΑΠΟΜΝΗΜΟΝΕΥΣΗ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΚΑΛΛΩΠΙΣΜΟΣ**: το `main()` καλεί τη μέτρηση
 * για το **zero-tolerance** σκέλος, και μετά ο `runSetRatchetCli` την ξανακαλεί
 * για το **ratchet** — δηλαδή **διπλή** σάρωση όλου του δέντρου. Μετρημένο:
 * **11,1s → 3,9s**. Η μέτρηση είναι καθαρή συνάρτηση του δέντρου μέσα σε μία
 * εκτέλεση, άρα η μνήμη είναι ταυτότητα, όχι προσέγγιση.
 */
let memo = null;

function measure() {
  if (memo) return memo;
  const verdict = judge(takeInventory(ROOT));
  const blocking = verdict.rows.filter((r) => BLOCKING.includes(r.state));
  memo = {
    verdict,
    blocking,
    violationIds: idsOf(verdict, STATES.INLINE_DECIDER).sort(),
    declarations: idsOf(verdict, STATES.DECLARED_DECIDER).sort(),
  };
  return memo;
}

/** Καθαρίζει τη μνήμη — **μόνο** για τις άγκυρες, που κρίνουν πολλά δέντρα στη σειρά. */
function resetMemo() { memo = null; }

/**
 * ⚠️ **ΤΥΠΩΝΕΤΑΙ ΚΑΙ ΣΤΟ ΜΗΔΕΝ.** Ένα «0» που δεν φαίνεται διαβάζεται ως «δεν
 * υπάρχει τέτοιος έλεγχος» — και το CHECK 3.56 γεννήθηκε **μονίμως πράσινο**
 * ακριβώς έτσι· το έπιασε η λογιστική, όχι η ανάγνωση.
 */
function ledgerLine(m) {
  const t = m.verdict.tally;
  return `📋 CHECK 3.68 — κρίνουν inline: ${t[STATES.INLINE_DECIDER]} · δηλωμένοι: ${t[STATES.DECLARED_DECIDER]}`
    + ` · SSoT: ${t[STATES.SSOT]} · δηλώσεις πολιτικής: ${t[STATES.POLICY_DECLARATION]}`
    + ` │ ⛔ φαντάσματα: ${t[STATES.GHOST_ROLE]} · ορφανές δηλώσεις: ${t[STATES.ORPHAN_DECLARATION]}`
    + ` · ορφανά legacy: ${t[STATES.ORPHAN_LEGACY]} · άκυρος λόγος: ${t[STATES.REASONLESS_DECLARATION]}`
    + ` · απόκλιση λεξιλογίου: ${t[STATES.VOCABULARY_DRIFT]}`;
}

/**
 * ⚠️ **ΤΑ ZERO-TOLERANCE ΔΕΝ ΜΠΑΙΝΟΥΝ ΠΟΤΕ ΣΕ BASELINE** — το `buildPayload`
 * **ρίχνει**. *Ένα zero-tol που κλειδώνεται με ένα `--write-baseline` δεν είναι
 * zero-tol* (πρότυπο CHECK 3.44 / 3.58).
 */
function buildPayload(m) {
  if (m.blocking.length > 0) {
    throw new Error(
      `άρνηση σποράς: ${m.blocking.length} μπλοκάρουσα κατάσταση(εις) δεν μπαίνουν σε baseline:\n`
      + m.blocking.map((r) => `   [${r.state}] ${r.id} — ${r.detail}`).join('\n'),
    );
  }
  return {
    _doc: 'CHECK 3.68 / ADR-801 §4 — violations = inline κριτές (Κ1) · declarations = κλειστό σύνολο εξαιρέσεων (Κ2).',
    _warning: 'Ο Κ3 (φάντασμα ρόλου) και οι ορφανές δηλώσεις είναι ZERO-TOLERANCE και ΔΕΝ μπαίνουν ΠΟΤΕ εδώ.',
    _health: 'Ο αριθμός ΔΕΝ είναι δείκτης υγείας: μετρά «όσα δεν ρωτούν ΑΚΟΜΗ τον κριτή». Θεραπεία = decideCapability.',
    generatedAt: new Date().toISOString().slice(0, 10),
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

function printReport(m) {
  console.log(ledgerLine(m));
  console.log('');
  for (const r of m.blocking) console.log(`  ⛔ [${r.state}] ${r.id} — ${r.detail}`);
  if (m.blocking.length) console.log('');
  console.log('  🔴 Κρίνουν με δικό τους σύνολο ρόλων (εκστρατεία → 0):');
  for (const id of m.violationIds) console.log(`     ${id}`);
  console.log('');
  console.log('  ✅ Δηλωμένες εξαιρέσεις (κλειστό σύνολο):');
  for (const id of m.declarations) console.log(`     ${id}`);
}

const DESCRIPTOR = {
  adr: 'ADR-801 §4 (CHECK 3.68)',
  skipEnv: 'SKIP_AUTHORITY_REGISTRY',
  baselineFile: BASELINE_FILE,
  measure,
  buildPayload,
  printReport,
  labels: { violations: 'inline κριτές', declarations: 'δηλωμένες εξαιρέσεις' },
  commands: {
    report: 'npm run authority-registry:report',
    baseline: 'npm run authority-registry:baseline',
    seed: 'npm run authority-registry:baseline',
  },
  messages: {
    worse: 'η αρχή της εξουσιοδότησης διασπάστηκε',
    newDeclLabel: 'ΝΕΑ ΕΞΑΙΡΕΣΗ ΑΠΟ ΤΟΝ ΕΝΑ ΚΡΙΤΗ',
    newDeclAdvice: [
      'Μπλοκάρει ΑΚΟΜΑ ΚΙ ΑΝ είναι σωστή — και αυτό είναι το σημείο: μια δεύτερη σωστή',
      'εξαίρεση είναι αρχιτεκτονικό γεγονός που πρέπει να δει άνθρωπος, αλλιώς η τρίτη',
      'προσγειώνεται σιωπηλά (πρότυπο CHECK 3.39/3.44/3.58).',
      `Αν είναι σκόπιμη: δήλωσέ τη στο \`${REGISTRY_FILE}\` → \`inlineDeciders[]\`, ΜΕ ΛΟΓΟ.`,
    ],
  },
};

async function main() {
  if (process.env.SKIP_AUTHORITY_REGISTRY === '1') {
    console.log('  ⏭ CHECK 3.68 παραλείφθηκε (SKIP_AUTHORITY_REGISTRY=1)');
    return process.exit(0);
  }
  const args = process.argv.slice(2);
  const explicit = args.includes('--report') || args.includes('--write-baseline') || args.includes('--all');
  const staged = args.filter((a) => !a.startsWith('-'));
  // ⚡ Η σκανδάλη αποφασίζει **ΑΝ** τρέχει, ποτέ **ΠΟΣΟ** σαρώνει: μερική
  //    ανάλυση είναι αναληθής όταν το ερώτημα αφορά ΟΛΟ το δέντρο (3.55).
  if (!explicit && staged.length > 0) {
    const fs = require('node:fs');
    const read = (rel) => {
      try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; }
    };
    if (!triggers(staged, read)) return process.exit(0);
  }

  if (!args.includes('--report') && !args.includes('--write-baseline')) {
    const m = measure();
    console.log(ledgerLine(m));
    if (m.blocking.length > 0) {
      console.error(`\n❌ CHECK 3.68 — ${m.blocking.length} μπλοκάρουσα κατάσταση(εις):\n`);
      for (const r of m.blocking) console.error(`   🚫 [${r.state}] ${r.id}\n      ${r.detail}`);
      console.error('\n   Θεραπεία ανά κατάσταση — ΔΕΝ είναι η ίδια:');
      console.error('     ghost-role            → ΣΒΗΣΕ τον νεκρό κλάδο (δεν πυροδοτεί ΠΟΤΕ),');
      console.error('                             ή δήλωσέ το στο legacyRoleNames[] ΜΕ ΛΟΓΟ αν ζει στα ΔΕΔΟΜΕΝΑ.');
      console.error('     orphan-declaration    → σβήσε τη δήλωση από το μητρώο.');
      console.error('     orphan-legacy         → σβήσε το legacy όνομα: δεν στέκεται πουθενά.');
      console.error('     reasonless-declaration→ γράψε λόγο ≥40 χαρακτήρων.');
      console.error('     vocabulary-drift      → ο δείκτης του μητρώου πάλιωσε έναντι του GLOBAL_ROLES.');
      console.error(`\n   Αναφορά: ${DESCRIPTOR.commands.report}`);
      return process.exit(1);
    }
  }
  return ratchet.runSetRatchetCli(DESCRIPTOR, process.argv);
}

if (require.main === module) {
  main().catch((e) => { console.error(`❌ CHECK 3.68 — ${e.message}`); process.exit(1); });
}

module.exports = { measure, resetMemo, buildPayload, printReport, ledgerLine, triggers, main, DESCRIPTOR, BASELINE_FILE };
