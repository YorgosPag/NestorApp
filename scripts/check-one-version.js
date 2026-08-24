#!/usr/bin/env node
/**
 * CHECK 3.65 — Η ΠΥΛΗ ΤΗΣ ΜΙΑΣ ΕΚΔΟΣΗΣ (ADR-800)
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ΤΟ ΕΡΩΤΗΜΑ: «υπάρχει **ΕΝΑ** σημείο δήλωσης και **ΜΙΑ** εγκατεστημένη έκδοση
 * για κάθε όνομα πακέτου μέσα στο workspace — και αν όχι, το είπε κάποιος με
 * λόγο;»
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * ΤΟ ΓΕΓΟΝΟΣ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ (μετρημένο 2026-08-25, ADR-598 G2 · ADR-800):
 * το `src/subapps/dxf-viewer/package.json` δήλωνε `jest@29` + `jsdom@24` ενώ η
 * ρίζα τρέχει `jest@30` + `jsdom@27`, **και** είχε script `"test": "jest"` ⇒
 * όποιος έτρεχε δοκιμές από μέσα έπαιρνε **άλλη μηχανή από το CI**. Είναι το
 * σχήμα του **ADR-749** («δύο μηχανές, δύο απαντήσεις») σε επίπεδο **εργαλείου
 * δοκιμών** — και εκεί κρυβόταν η δεύτερη, αόρατη διαδρομή προς το ευάλωτο
 * `tar` (το `pnpm why` από τη ρίζα **δεν διασχίζει workspaces**).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΠΗΓΕΣ, ΔΥΟ ΕΡΩΤΗΜΑΤΑ — ΠΟΤΕ ΕΝΑ ΜΕ «Ή» (πρότυπο CHECK 3.41)
 * ─────────────────────────────────────────────────────────────────────────────
 * • **Κ1 · ΔΗΛΩΣΗ** (από τα *manifests*): το ίδιο όνομα δηλώνεται από >1
 *   **εσωτερικό** μέλος. Πιάνει την **ΑΙΤΙΑ**.
 * • **Κ2 · ΕΠΙΛΥΣΗ** (από το *lockfile*): το ίδιο όνομα εγκαταστάθηκε σε >1
 *   έκδοση. Πιάνει το **ΑΠΟΤΕΛΕΣΜΑ**, ακόμη κι όταν η αιτία δεν είναι δήλωση.
 *
 * Είναι **αποδεδειγμένα ανεξάρτητα**, με ζωντανά δεδομένα της 2026-08-25:
 *   – `react`  → Κ1 🔴 (δηλωνόταν δύο φορές) / Κ2 ✅ (και τα δύο 19.2.1)
 *   – `jest`   → Κ1 🔴 **και** Κ2 🔴
 * Ένας κανόνας με «ή» θα έμενε **πράσινος πάνω στο μισό ελάττωμα**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ, ΚΑΙ ΠΟΥ ΤΟΥΣ ΞΕΠΕΡΝΑΜΕ *(ερευνήθηκε 2026-08-25)*
 * ─────────────────────────────────────────────────────────────────────────────
 * • **Google/Bazel** — *One-Version Rule*: ακριβώς **μία** έκδοση κάθε τρίτης
 *   εξάρτησης, γιατί δύο γεννούν το *diamond dependency problem*.
 * • **Nx** — *single version policy*: οι εξαρτήσεις ορίζονται **μία φορά, στο
 *   root package.json**· τα υπόλοιπα projects δεν τις ξαναδηλώνουν.
 * • **pnpm catalogs** + **syncpack** / **pnpm-catalog-lint** — δηλώνεις μία τιμή
 *   στο `pnpm-workspace.yaml` και **επιβάλλεις** το `catalog:` με εξωτερικό
 *   εργαλείο.
 *
 * **Πού τους ξεπερνάμε — και είναι μετρημένο, όχι ρητορικό:**
 *   1. Τα syncpack/pnpm-catalog-lint κρίνουν **ΔΗΛΩΣΕΙΣ**. Είναι δομικά τυφλά
 *      στο ότι μια δήλωση μπορεί να είναι **ΨΕΜΑ**: εδώ το subapp δήλωνε
 *      `react: ^18.3.1` και έτρεχε **19.2.1**, επειδή ένα `pnpm.overrides` το
 *      ξαναέγραφε. Το Κ2 διαβάζει το **lockfile**, δηλαδή τι *έγινε*.
 *   2. Το `@open-pioneer/check-pnpm-duplicates` κρίνει το lockfile αλλά σε
 *      **ΟΛΟΝ** τον γράφο (μεταβατικοί doppelgangers) — άλλο ερώτημα, με
 *      εκατοντάδες **νόμιμες** εγγραφές εδώ. Εμείς κρίνουμε **τις άμεσες
 *      εξαρτήσεις των μελών**, που είναι το πεδίο του One Version Rule.
 *   3. Οι μεγάλοι εφαρμόζουν **μία** πολιτική σε όλα τα μέλη. Εδώ η πολιτική
 *      **ΠΑΡΑΓΕΤΑΙ** από αυτό που το ίδιο το μέλος δηλώνει ότι είναι: ένα
 *      **διανεμητέο** πακέτο *οφείλει* να δηλώνει ό,τι εισάγει (συμβόλαιο npm,
 *      επιχείρημα Rush κατά των phantom dependencies)· ένα **εσωτερικό** που
 *      μεταγλωττίζεται μέσα στην εφαρμογή *οφείλει να μην το κάνει*.
 *
 * 🔴 **ΓΙΑΤΙ ΑΠΟΡΡΙΦΘΗΚΕ Ο ΚΑΤΑΛΟΓΟΣ (`catalog:`) ΩΣ ΛΥΣΗ — ΜΕ ΜΕΤΡΗΣΗ**
 *   α. Το `pnpm-workspace.yaml` **είχε ήδη** μπλοκ `catalog:` με 12 εγγραφές και
 *      **ΚΑΝΕΝΑ** manifest δεν έγραφε ποτέ `"catalog:"` ⇒ μηδέν δέσμευση.
 *   β. Οι **6 από τις 12** τιμές του ήταν **ΛΑΘΟΣ** (έλεγε `react: 18.3.1` ενώ
 *      το δέντρο τρέχει `19.2.1`) ⇒ τρίτος αριθμός, τρίτο σημείο.
 *   γ. Το `catalogMode: strict` της pnpm απαιτεί **≥10.12.1** και το repo
 *      δεσμεύεται σε **pnpm@9.14.0**· και ακόμη και εκεί, το `strict`
 *      περιορίζει το `pnpm add` — **δεν** επιβάλλει `catalog:` αντί λεκτικού.
 *   ⇒ Ο κατάλογος σε συντηρεί **δύο** αριθμούς. Το «ένα σημείο δήλωσης» κάνει
 *      τη διαφωνία **μη εκφράσιμη**. Δεν απαγορεύουμε τους καταλόγους —
 *      απαγορεύουμε τους **διακοσμητικούς** (κατάστιχο Δ).
 *
 * ⚠️ **ΔΕΝ είναι ratchet — καμία baseline, ποτέ.** Δεν υπάρχει «λιγότερες
 * μηχανές δοκιμών από χθες»: **μία** αρκεί για να απαντήσει το CI άλλο πράγμα
 * από τον προγραμματιστή. Το zero-tolerance είναι **εφικτό επειδή** το ίδιο
 * ρεύμα δουλειάς καθάρισε τους παραβάτες, **μετρημένα** (πρότυπο 3.48/3.55/3.61).
 *
 * Αναφορά: `npm run one-version:report` · Escape: `SKIP_ONE_VERSION=1`
 */

'use strict';

const path = require('node:path');

const { BLOCKING, LEDGER_STATES, sweep } = require('./lib/one-version/gate.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const GREEN = '\x1b[0;32m';
const RED = '\x1b[0;31m';
const YELLOW = '\x1b[1;33m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

const LEDGER_TITLES = {
  names: 'Α · ΟΝΟΜΑΤΑ ΠΑΚΕΤΩΝ',
  declarations: 'Β · ΔΗΛΩΣΕΙΣ ΜΕΛΩΝ',
  members: 'Γ · ΜΕΛΗ WORKSPACE',
  catalog: 'Δ · ΚΑΤΑΛΟΓΟΣ',
  exceptions: 'Ε · ΕΞΑΙΡΕΣΕΙΣ',
};

const ADVICE = [
  'Θεραπεία ανά κατάσταση:',
  '  redeclared-dependency  → σβήσε τη δήλωση από το ΕΣΩΤΕΡΙΚΟ μέλος· η ρίζα την κατέχει.',
  '  version-split          → ευθυγράμμισε τις εκδόσεις και τρέξε pnpm install.',
  '  overridden-declaration → κάνε τη δήλωση ίση με το override (το manifest να λέει την ΑΛΗΘΕΙΑ).',
  '  lockfile-desync        → άλλαξε manifest χωρίς install· τρέξε pnpm install.',
  '  unlisted-manifest      → νέο package.json μέσα στα globs: είτε install, είτε δεν ανήκει εκεί.',
  '  unreferenced-catalog   → ή γράψε "catalog:" στο manifest, ή σβήσε την εγγραφή.',
  '',
  'Αν ΔΥΟ εσωτερικά μέλη ΠΡΕΠΕΙ να δηλώνουν το ίδιο πακέτο, δήλωσέ το στο',
  '.one-version.json — ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ.',
];

/**
 * ⚠️ Τυπώνεται **ΚΑΘΕ** κάδος, **ακόμα και στο μηδέν**: ένα «0» που δεν
 * φαίνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος» — το σχήμα που αυτό το
 * repo έχει πληρώσει εννιά φορές.
 */
function printLedger(ledgers) {
  for (const [name, states] of Object.entries(LEDGER_STATES)) {
    const { tally, population } = ledgers[name];
    console.log(`${DIM}  CHECK 3.65 — ${LEDGER_TITLES[name]} (${population})${NC}`);
    for (const state of states) {
      const mark = BLOCKING.includes(state) ? (tally[state] > 0 ? '⛔' : '✅') : '  ';
      console.log(`${DIM}     ${mark} ${state.padEnd(28)} ${String(tally[state]).padStart(6)}${NC}`);
    }
  }
}

/**
 * Η ΣΚΑΝΔΑΛΗ — αποφασίζει **ΑΝ** τρέχει, ποτέ **ΠΟΣΟ** κρίνει.
 *
 * ⚠️ Ο **ίδιος ο κώδικας της πύλης** είναι σκανδάλη: αλλαγή στο κριτήριο πρέπει
 * να **ασκεί** το κριτήριο, αλλιώς περνά χωρίς να δοκιμαστεί ποτέ (μάθημα
 * CHECK 3.43 · 3.57).
 */
function affects(file) {
  const rel = file.split(path.sep).join('/');
  return (
    rel === 'pnpm-lock.yaml' ||
    rel === 'pnpm-workspace.yaml' ||
    rel === '.one-version.json' ||
    rel === 'package.json' ||
    /(^|\/)package\.json$/.test(rel) ||
    rel.startsWith('scripts/lib/one-version/') ||
    rel === 'scripts/check-one-version.js'
  );
}

function main(argv = process.argv) {
  if (process.env.SKIP_ONE_VERSION) return 0;

  const staged = argv.slice(2).filter((a) => !a.startsWith('--'));
  if (staged.length > 0 && !staged.some(affects)) return 0;

  const { ledgers, violations } = sweep(REPO_ROOT);
  printLedger(ledgers);

  if (violations.length === 0) {
    console.log(`${GREEN}  ✅ CHECK 3.65 — ένα σημείο δήλωσης, μία εγκατεστημένη έκδοση${NC}`);
    return 0;
  }

  console.log(`${RED}  🚫 CHECK 3.65 — ${violations.length} παραβίαση(εις) της πολιτικής μίας έκδοσης:${NC}`);
  for (const v of violations) {
    console.log(`${YELLOW}     [${v.state}] ${v.id} — ${v.detail}${NC}`);
  }
  for (const line of ADVICE) console.log(`${DIM}     ${line}${NC}`);
  return 1;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`${RED}⛔ CHECK 3.65 — ${error.message}${NC}`);
    process.exit(1);
  }
}

module.exports = { LEDGER_TITLES, affects, main, printLedger };
