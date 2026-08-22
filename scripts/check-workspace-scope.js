#!/usr/bin/env node
/**
 * CHECK 3.60 — Η ΠΥΛΗ ΤΗΣ ΕΜΒΕΛΕΙΑΣ ΤΟΥ ΧΩΡΟΥ (ADR-787 §5.3 γ · ζ)
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ΤΟ ΕΡΩΤΗΜΑ: «ζει αυτή η σελίδα πίσω από το πρόθεμα χώρου — και αν όχι, το είπε
 * κάποιος με λόγο;»
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **Η ΠΡΟΕΠΙΛΟΓΗ ΕΙΝΑΙ «ΜΠΑΙΝΕΙ».** Δύο κριτήρια για την ευθεία κατεύθυνση
 * *(«ποια σελίδα ανήκει σε χώρο;»)* μετρήθηκαν και **έπεσαν** — >60% και 99,88%
 * ψευδώς θετικά· η πλήρης αιτιολογία στο `.workspace-scope.json` → `$whyInverted`.
 * Κρατήθηκε η **αντίστροφη**, με το πρότυπο του `tenant-config.ts:22`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΟΙ ΚΑΝΟΝΕΣ — ΔΥΟ ΑΝΕΞΑΡΤΗΤΟΙ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή» (μάθημα CHECK 3.41)
 * ─────────────────────────────────────────────────────────────────────────────
 * | | Κανόνας | Θεραπεία | Μηχανισμός |
 * |---|---|---|---|
 * | **Κ1** | σελίδα **εντός** εμβέλειας **χωρίς** πρόθεμα | μετακίνησέ την | 🔴 **RATCHET κατά ταυτότητα** |
 * | **Κ2** | **νέα** ή **ορφανή** δήλωση εξαίρεσης | δες την με μάτια ανθρώπου | ⛔ **κλειστό σύνολο** |
 *
 * Έχουν **διαφορετική θεραπεία**: το Κ1 λέει *«λείπει δουλειά»*, το Κ2 *«κάποιος
 * αφαίρεσε σελίδα από τον χώρο — γιατί;»*. Ένας κανόνας με «ή» θα έλεγε «κόκκινο»
 * και στα δύο, και ο επόμενος θα διόρθωνε λάθος πράγμα.
 *
 * ⚠️ **ΓΙΑΤΙ ΤΟ Κ1 ΕΙΝΑΙ RATCHET ΚΑΙ ΟΧΙ ZERO-TOL**: σήμερα **καμία** σελίδα δεν
 * έχει πρόθεμα — η μετακίνηση δεν έχει γίνει. Zero-tol θα γεννιόταν με ~131
 * παραβιάσεις, δηλαδή **μονίμως κόκκινο ⇒ `SKIP_` ⇒ διακοσμητική πύλη** (η παγίδα
 * που το CHECK 3.39 δοκίμασε και απέρριψε ρητά). Ratchet σημαίνει: ο αριθμός
 * **μόνο μειώνεται**, και η εκστρατεία τελειώνει στο μηδέν.
 *
 * ⚠️ **ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ, ΟΧΙ ΚΑΤΑ ΠΛΗΘΟΣ**: με αριθμό, η **ανταλλαγή** (μετακινώ το
 * `/projects`, γεννώ το `/reports` χωρίς πρόθεμα — 131 → 131) περνά αθόρυβα.
 * Είναι το μάθημα του ADR-749, και ο λόγος που χρησιμοποιείται το `runSetRatchetCli`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ, ΚΑΝΕΝΑ ΝΕΟ WORKFLOW, **ΚΑΙ ΚΑΜΙΑ ΣΚΑΝΔΑΛΗ**
 * ─────────────────────────────────────────────────────────────────────────────
 * `runSetRatchetCli` (ADR-749/770) · `scope.js` για το κλειστό σύνολο · το
 * πρόθεμα **διαβάζεται** από το TS SSoT. Layer 2 = job στο **υπάρχον**
 * `ssot-discover.yml` ⇒ μητρώο πυλών **αμετάβλητο** (CHECK 3.37).
 *
 * ⚡ **Ο ΕΛΕΓΧΟΣ ΕΙΝΑΙ ΠΑΝΤΑ ΠΛΗΡΗΣ — ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΦΘΗΝΟΤΕΡΟ ΑΠΟ ΤΗ ΣΚΑΝΔΑΛΗ.**
 * Μετρημένο: **41ms** για ολόκληρο το `(app)` *(138 σελίδες)*. Μια λίστα
 * μονοπατιών-σκανδάλης θα κόστιζε το ίδιο και θα πρόσθετε **δεύτερη αυθεντία που
 * αποκλίνει σιωπηλά** — το σχήμα που απέτυχε μετρημένα στα CHECK 3.34 · 3.37.
 * *Όταν το πλήρες είναι φθηνό, η μερική ανάλυση δεν είναι βελτιστοποίηση· είναι
 * ρίσκο χωρίς αντάλλαγμα.*
 *
 * Escape: `SKIP_WORKSPACE_SCOPE=1`
 */

'use strict';

const path = require('path');
const { PROJECT_ROOT, runSetRatchetCli } = require('./lib/ratchet-baseline');
const { buildScope, SCOPE_FILE } = require('./lib/workspace-scope/scope');

const BASELINE_FILE = path.join(PROJECT_ROOT, '.workspace-scope-baseline.json');

/**
 * ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ — ρητές, κλειστές. Άγνωστη ⇒ `throw` **με όνομα**.
 *
 * ⚠️ Οι **μπλοκάροντες** κάδοι τυπώνονται **ακόμα και στο μηδέν** (μάθημα CHECK
 * 3.56): ένα «0» που δεν φαίνεται διαβάζεται ως *«δεν υπάρχει τέτοιος έλεγχος»*.
 */
const STATES = Object.freeze({
  ORPHAN: 'orphan-declaration',
  UNPREFIXED: 'unprefixed-in-scope',
  PREFIXED: 'prefixed',
  OUTSIDE: 'declared-outside',
});

const BLOCKING = Object.freeze([STATES.ORPHAN]);
const RATCHETED = Object.freeze([STATES.UNPREFIXED]);
const ORDER = Object.freeze([STATES.ORPHAN, STATES.UNPREFIXED, STATES.PREFIXED, STATES.OUTSIDE]);

// =============================================================================
// Η ΜΕΤΡΗΣΗ
// =============================================================================

function measure(_staged = [], root = PROJECT_ROOT) {
  const scope = buildScope(root);
  const findings = [];

  // ── Κ2: ορφανή δήλωση ─────────────────────────────────────────────────────
  // Εξαίρεση για φάκελο που ΔΕΝ υπάρχει πια. Κάθε νεκρή γραμμή είναι ένα όνομα
  // που ο χρήστης δεν μπορεί να πάρει ΧΩΡΙΣ ΛΟΓΟ — και το κλειστό σύνολο θα
  // μεγάλωνε για πάντα αν κανείς δεν ρωτούσε.
  for (const segment of scope.orphanDeclarations) {
    findings.push({
      state: STATES.ORPHAN,
      id: segment,
      detail: `δηλωμένη εξαίρεση για φάκελο που δεν υπάρχει στο (app) — σβήσε τη γραμμή από ${path.basename(SCOPE_FILE)}`,
    });
  }

  // ── Κ1: σελίδα εντός εμβέλειας χωρίς πρόθεμα ──────────────────────────────
  for (const page of scope.inside) {
    const hasPrefix = page.url.split('/').filter(Boolean)[0] === scope.prefix;
    findings.push({
      state: hasPrefix ? STATES.PREFIXED : STATES.UNPREFIXED,
      id: page.url,
      file: page.file,
    });
  }

  for (const page of scope.excluded) {
    findings.push({ state: STATES.OUTSIDE, id: page.url, file: page.file });
  }

  // ── ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ, FAIL-CLOSED ────────────────────────────────────────
  const ledger = Object.fromEntries(ORDER.map((s) => [s, []]));
  for (const f of findings) {
    if (!ledger[f.state]) {
      throw new Error(`CHECK 3.60: ΑΓΝΩΣΤΗ ΚΑΤΑΣΤΑΣΗ «${f.state}» — κάθε εύρημα ΠΡΕΠΕΙ να έχει κάδο με όνομα`);
    }
    ledger[f.state].push(f);
  }
  const counted = ORDER.reduce((sum, s) => sum + ledger[s].length, 0);
  if (counted !== findings.length) {
    throw new Error(`CHECK 3.60: η λογιστική ΔΕΝ κλείνει — ${counted} σε κάδους έναντι ${findings.length} ευρημάτων`);
  }

  const blocking = findings.filter((f) => BLOCKING.includes(f.state));
  const ratcheted = findings.filter((f) => RATCHETED.includes(f.state));

  return {
    scope,
    ledger,
    findings,
    blocking,
    // Ο Κ1 μπαίνει στο ratchet· ο Κ2 (ορφανή) ΠΟΤΕ — βλ. `buildPayload`.
    violationIds: ratcheted.map((f) => f.id),
    violations: ratcheted,
    declarations: [...scope.outside.keys()].sort(),
  };
}

// =============================================================================
// BASELINE — Ο Κ2 ΔΕΝ ΚΛΕΙΔΩΝΕΤΑΙ ΠΟΤΕ
// =============================================================================

/**
 * ⚠️ **ΤΟ `buildPayload` ΑΡΝΕΙΤΑΙ ΝΑ ΓΡΑΨΕΙ BASELINE ΜΕ ΟΡΦΑΝΗ ΔΗΛΩΣΗ.**
 * *Ένα zero-tolerance που κλειδώνεται με ένα `--write-baseline` δεν είναι
 * zero-tolerance* (πρότυπο CHECK 3.44/3.58).
 */
function buildPayload(m) {
  if (m.blocking.length) {
    throw new Error(
      `CHECK 3.60: ΑΡΝΗΣΗ ΕΓΓΡΑΦΗΣ BASELINE — ${m.blocking.length} ορφανή/ές δήλωση/εις. ` +
        'Οι ⛔ καταστάσεις ΔΕΝ κλειδώνονται· σβήσε τη νεκρή γραμμή αντί να τη θάψεις.',
    );
  }
  return {
    _doc: 'CHECK 3.60 — ADR-787 §5.3 γ. violations = σελίδες εντός εμβέλειας ΧΩΡΙΣ πρόθεμα (Κ1) · declarations = κλειστό σύνολο εξαιρέσεων (Κ2).',
    _warning: 'Ο Κ2 «orphan-declaration» είναι ZERO-TOLERANCE και ΔΕΝ μπαίνει ΠΟΤΕ εδώ.',
    _campaign: 'Ο αριθμός των violations ΔΕΝ είναι δείκτης υγείας — είναι «πόσες σελίδες δεν έχουν μετακινηθεί ΑΚΟΜΗ». Η εκστρατεία τελειώνει στο 0 (ADR-787 §5.3, Βήμα 3).',
    generatedAt: new Date().toISOString().slice(0, 10),
    violations: [...m.violationIds].sort(),
    declarations: m.declarations,
  };
}

// =============================================================================
// ΑΝΑΦΟΡΑ
// =============================================================================

function printReport(m) {
  const { scope, ledger } = m;
  console.log('\n📋 CHECK 3.60 — εμβέλεια χώρου (ADR-787 §5.3 γ)\n');
  console.log(`   πρόθεμα (από το TS SSoT): /${scope.prefix}`);
  console.log(`   σελίδες (app): ${scope.pages.length}\n`);

  for (const state of ORDER) {
    const mark = BLOCKING.includes(state) ? '⛔' : RATCHETED.includes(state) ? '🔴' : '✅';
    console.log(`   ${mark} ${state.padEnd(22)} ${String(ledger[state].length).padStart(4)}`);
  }

  console.log(`\n   δηλωμένες εξαιρέσεις: ${m.declarations.length}`);
  for (const segment of m.declarations) {
    const why = scope.outside.get(segment) ?? '';
    console.log(`     · ${segment.padEnd(18)} ${why.slice(0, 96)}${why.length > 96 ? '…' : ''}`);
  }

  if (ledger[STATES.UNPREFIXED].length) {
    console.log('\n   🔴 εντός εμβέλειας, χωρίς πρόθεμα (τα 12 πρώτα):');
    for (const f of ledger[STATES.UNPREFIXED].slice(0, 12)) console.log(`     · ${f.id}`);
    if (ledger[STATES.UNPREFIXED].length > 12) {
      console.log(`     … και άλλες ${ledger[STATES.UNPREFIXED].length - 12}`);
    }
  }
  console.log('');
}

// =============================================================================
// CLI
// =============================================================================

const DESCRIPTOR = {
  adr: 'ADR-787 §5.3 γ (CHECK 3.60)',
  skipEnv: 'SKIP_WORKSPACE_SCOPE',
  baselineFile: BASELINE_FILE,
  measure,
  buildPayload,
  printReport,
  violationId: (f) => (typeof f === 'string' ? f : f.id),
  labels: {
    violations: 'σελίδες εντός εμβέλειας χωρίς πρόθεμα',
    declarations: 'δηλωμένες εξαιρέσεις',
  },
  messages: {
    worse: 'γεννήθηκε σελίδα που ανήκει σε χώρο αλλά ζει έξω από το πρόθεμα',
    newDeclLabel: '🚫 ΝΕΑ ΕΞΑΙΡΕΣΗ ΕΜΒΕΛΕΙΑΣ',
    newDeclAdvice: [
      'Μια νέα εξαίρεση βγάζει σελίδα ΕΞΩ από τον χώρο — δηλαδή την κάνει κοινή για όλους.',
      'Μπλοκάρει ΑΚΟΜΑ ΚΙ ΑΝ είναι σωστή, ώστε να τη δει άνθρωπος: η προεπιλογή είναι',
      '«μπαίνει», και κάθε αφαίρεση από τον χώρο είναι απόφαση ασφαλείας, όχι λεπτομέρεια.',
      'Αν είναι σκόπιμη: ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ στο .workspace-scope.json.',
    ],
  },
  commands: {
    report: 'npm run workspace-scope:report',
    baseline: 'npm run workspace-scope:baseline',
    seed: 'node scripts/check-workspace-scope.js --all --write-baseline',
  },
};

async function main(argv = process.argv) {
  if (process.env.SKIP_WORKSPACE_SCOPE) return process.exit(0);
  return runSetRatchetCli(DESCRIPTOR, argv);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`⛔ CHECK 3.60 — ${e.message}`);
    process.exit(1);
  });
}

module.exports = { measure, buildPayload, STATES, ORDER, BLOCKING, RATCHETED, DESCRIPTOR };
