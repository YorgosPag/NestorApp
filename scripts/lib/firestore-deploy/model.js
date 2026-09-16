/**
 * ADR-865 — ΤΟ ΜΟΝΤΕΛΟ ΤΗΣ ΑΠΟΔΕΙΞΗΣ ΑΝΑΠΤΥΞΗΣ.
 *
 * Καθαρές συναρτήσεις + **ένα** σημείο ανάγνωσης δίσκου. Το χρησιμοποιούν **και** ο γεννήτορας
 * (`record-deploy.js`) **και** η πύλη (`check-firestore-deploy-proof.js`) — μία σειριοποίηση,
 * ένα αποτύπωμα (μάθημα ADR-749: δύο μηχανές = δύο αριθμοί για το ίδιο δέντρο).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΕΡΩΤΗΣΗ: «ΥΠΑΡΧΕΙ ΑΠΟΔΕΙΞΗ ΟΤΙ ΑΥΤΑ ΤΑ BYTES ΕΦΥΓΑΝ;»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **ΟΧΙ** «τι είναι ζωντανά;» — αυτό θέλει δίκτυο και διαπιστευτήρια, που ένας hook δεν έχει
 * (μετρημένο 2026-09-16: **κανένα** workflow δεν φέρει secret Firebase· το firebase-tools εκεί
 * σηκώνει **μόνο** emulator). Η ερώτηση γίνεται **offline**, με sha256 δύο αρχείων.
 *
 * 🔴 **ΚΑΙ ΤΟ `--dry-run` ΕΙΝΑΙ ΤΥΦΛΟ — ΜΕΤΡΗΘΗΚΕ.** Το `firebase deploy --only firestore:rules
 * --dry-run` απάντησε *«Dry run complete!»* με **exit 0** ενώ η απόκλιση υπήρχε αποδεδειγμένα:
 * επικυρώνει **μεταγλώττιση**, όχι **ισοτιμία με το ανεπτυγμένο**. Το τεκμηριωμένο *«already up
 * to date, skipping»* τυπώνεται **μόνο σε πραγματικό deploy** — δηλαδή μόνο **αφού γράψεις**.
 * Πράσινο που σημαίνει «δεν κοίταξα» (σχήμα N.11 · N.12 · N.18).
 *
 * ⚠️ **ΚΑΜΙΑ ΧΕΙΡΟΓΡΑΦΗ ΚΑΤΑΣΤΑΣΗ «ΕΚΚΡΕΜΕΙ».** Το μητρώο κρατά **μόνο** ό,τι συνέβη
 * (append-only). Η εκκρεμότητα **ΠΑΡΑΓΕΤΑΙ**: τρέχον αποτύπωμα ≠ τελευταίο αναπτυγμένο. Ένα
 * πεδίο `pending` που το συντηρεί άνθρωπος θα ήταν δεύτερη αυθεντία, και θα σάπιζε ακριβώς όπως
 * σάπισε η γνώση που γέννησε αυτό το ADR.
 *
 * @module scripts/lib/firestore-deploy/model
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { stableStringify, sha256 } = require('../i18n-shell-slice/slice-build');

const ROOT = path.resolve(__dirname, '..', '..', '..');

const paths = {
  root: ROOT,
  firebaseJson: path.join(ROOT, 'firebase.json'),
  ledger: path.join(ROOT, '.firestore-deploy-ledger.json'),
  of: (relative) => path.join(ROOT, relative),
};

/** Σχετική διαδρομή με `/` — για μηνύματα **και** για `git show`. */
const rel = (absolute) => path.relative(ROOT, absolute).replace(/\\/g, '/');

const digestOf = (bytes) => `sha256:${sha256(bytes)}`;

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

// ============================================================================
// Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — τι είναι «αναπτύξιμο», και ποιος το λέει
// ============================================================================

/**
 * **Οι στόχοι που αναπτύσσονται στο Firebase**, με το κλειδί του `firebase.json` που τους
 * δηλώνει. Ο πίνακας δεν λέει **ποιο αρχείο** — αυτό το λέει το `firebase.json`. Λέει **ποιοι
 * στόχοι υπάρχουν** και **από πού διαβάζεται η διαδρομή** του καθενός.
 *
 * ⚠️ Το `sourceOverride` υπάρχει για **έναν** λόγο, και είναι μετρημένος: το `firebase.json`
 * δηλώνει `firestore.rules.compiled` — αρχείο **παραγόμενο** (`scripts/build-firestore-rules.js`,
 * predeploy hook) και **untracked**. Αποτύπωμα πάνω σε untracked παραγόμενο θα άλλαζε χωρίς
 * αλλαγή περιεχομένου και θα ήταν **αόρατο στο git**. Η αυθεντία είναι η **πηγή**.
 */
const DEPLOY_TARGETS = Object.freeze({
  'firestore:rules': Object.freeze({
    jsonPath: ['firestore', 'rules'],
    sourceOverride: 'firestore.rules',
    overrideWhy:
      'Το firebase.json δηλώνει το ΠΑΡΑΓΟΜΕΝΟ firestore.rules.compiled (predeploy: '
      + 'scripts/build-firestore-rules.js), που είναι untracked. Η αυθεντία —και ό,τι βλέπει το '
      + 'git— είναι η πηγή firestore.rules.',
  }),
  'firestore:indexes': Object.freeze({
    jsonPath: ['firestore', 'indexes'],
    sourceOverride: null,
    overrideWhy: null,
  }),
  storage: Object.freeze({
    jsonPath: ['storage', 'rules'],
    sourceOverride: null,
    overrideWhy: null,
  }),
});

/**
 * **Τα κλειδιά του `firebase.json` που ΔΕΝ κρίνει αυτή η πύλη** — κάθε ένα με γραπτό λόγο.
 *
 * ⚠️ Ο λόγος δεν είναι διακοσμητικός (ιδίωμα `unscopedReason` · `.gate-inventory.json`): μια
 * εξαίρεση χωρίς λόγο είναι **παράκαμψη με άλλο όνομα**. Και το σύνολο είναι **κλειστό**: νέο
 * κλειδί στο `firebase.json` χωρίς γραμμή εδώ **κοκκινίζει** (Κ2) — fail-closed, ώστε μια νέα
 * βάση ή νέος στόχος να μη γίνει σιωπηλά αφύλακτος.
 */
const NOT_JUDGED = Object.freeze({
  functions: 'Δικός του κύκλος ζωής και δικό του predeploy (npm --prefix functions run build)· '
    + 'αναπτύσσεται ρητά με firebase deploy --only functions και έχει δικό του ADR.',
  hosting: 'ΔΕΝ αναπτύσσεται στο Firebase: η παραγωγή τρέχει σε Netcup (nestorconstruct.gr) και το '
    + 'Firebase Hosting είναι αδρανές — η γραμμή μένει στο firebase.json ως ιστορικό.',
  emulators: 'Τοπική διαμόρφωση εξομοιωτή· δεν φεύγει ποτέ προς κανένα project.',
});

/** Η δηλωμένη διαδρομή ενός στόχου μέσα στο `firebase.json` — `null` όταν δεν δηλώνεται. */
function declaredPath(firebaseJson, target) {
  let node = firebaseJson;
  for (const key of DEPLOY_TARGETS[target].jsonPath) {
    if (node === null || typeof node !== 'object' || !(key in node)) return null;
    node = node[key];
  }
  return typeof node === 'string' ? node : null;
}

/**
 * **Το αρχείο-πηγή ενός στόχου** — η διαδρομή του `firebase.json`, ή το override όταν εκείνη
 * δείχνει σε παραγόμενο artifact. `null` ⇒ ο στόχος δεν δηλώνεται καθόλου.
 */
function sourceOf(firebaseJson, target) {
  const declared = declaredPath(firebaseJson, target);
  if (declared === null) return null;
  return DEPLOY_TARGETS[target].sourceOverride ?? declared;
}

// ============================================================================
// ΜΗΤΡΩΟ
// ============================================================================

const LEDGER_DOC =
  'ADR-865 — ΜΗΤΡΩΟ ΑΝΑΠΤΥΞΕΩΝ FIREBASE. ΠΑΡΑΓΕΤΑΙ από `npm run firestore:deploy` και είναι '
  + 'APPEND-ONLY: γραμμή που γράφτηκε δεν αλλάζει και δεν σβήνεται ποτέ (CHECK 3.86 Κ3). '
  + 'ΜΗΝ το γράψεις στο χέρι — η γραμμή είναι ΠΑΡΑΓΩΓΟ της πράξης, όχι ισχυρισμός για αυτήν.';

/** Το μητρώο, ή κενό όταν δεν υπάρχει ακόμη. */
function loadLedger() {
  if (!fs.existsSync(paths.ledger)) return { $doc: LEDGER_DOC, deployments: [] };
  const parsed = JSON.parse(fs.readFileSync(paths.ledger, 'utf8'));
  return { $doc: parsed.$doc ?? LEDGER_DOC, deployments: Array.isArray(parsed.deployments) ? parsed.deployments : [] };
}

/** Κανονικά bytes μητρώου — ταξινομημένα κλειδιά, LF, τελικό newline (ίδια μηχανή με το 3.85). */
function renderLedger(ledger) {
  return stableStringify({ $doc: LEDGER_DOC, deployments: ledger.deployments });
}

/** Ταυτότητα γραμμής — για τη σύγκριση append-only του Κ3. */
const rowKey = (row) => stableStringify(row);

/** Η **τελευταία** καταγεγραμμένη ανάπτυξη ενός στόχου, ή `null`. */
function lastDeployment(ledger, target) {
  for (let i = ledger.deployments.length - 1; i >= 0; i--) {
    if (ledger.deployments[i].target === target) return ledger.deployments[i];
  }
  return null;
}

/** Τα bytes ενός αρχείου του δέντρου, ή `null` όταν λείπει. */
function readSource(relative) {
  const file = paths.of(relative);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function loadFirebaseJson() {
  return JSON.parse(fs.readFileSync(paths.firebaseJson, 'utf8'));
}

module.exports = {
  paths,
  rel,
  digestOf,
  stableStringify,
  DIGEST_RE,
  DEPLOY_TARGETS,
  NOT_JUDGED,
  LEDGER_DOC,
  declaredPath,
  sourceOf,
  loadLedger,
  renderLedger,
  rowKey,
  lastDeployment,
  readSource,
  loadFirebaseJson,
};
