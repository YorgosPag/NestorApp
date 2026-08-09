#!/usr/bin/env node
/**
 * SSoT για την ΑΝΑΓΝΩΣΗ της εξόδου του `tsc` — ADR-663 / ADR-757 ΦΑΣΗ Β #2.
 *
 * Ο αδελφός του `tsc-runner.js`. Εκείνο ξέρει να **τρέχει** τον μεταγλωττιστή και
 * να ονομάζει τους τρόπους που **δεν** έτρεξε (6 ρητές καταστάσεις, μοντέλο
 * Nagios). Αυτό ξέρει να **διαβάζει** ό,τι τύπωσε. Ήταν το κομμάτι που έλειπε.
 *
 * ── ΤΟ ΣΥΜΒΑΝ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ (08/08/2026, run 31258075883) ──────────────────
 * Το CHECK 3.29 ανέφερε «σφάλματα τύπων αυξήθηκαν σε **191 αρχεία**», τύπωσε 20
 * ονόματα και «… and 171 more». Η διάγνωση ήταν **δομικά αδύνατη** — αλλά ΟΧΙ
 * επειδή η κονσόλα έκοβε στα 20. Ακόμη κι αν τύπωνε και τα 191, η απάντηση δεν
 * θα υπήρχε: το `parseErrors()` **μετρούσε** τα διαγνωστικά και **πετούσε τον
 * κωδικό TS, τη γραμμή, τη στήλη και το μήνυμα** την ώρα του parse. Το ερώτημα
 * «ένα ριζικό αίτιο που διαχέεται ή συσσώρευση 3,5 εβδομάδων;» απαντιέται
 * **μόνο** από τους κωδικούς — και οι κωδικοί δεν επιβίωναν του parser.
 *
 * 🔑 **Μια πύλη που πετάει τη διάγνωση τη στιγμή της μέτρησης δεν μπορεί να
 * εξηγηθεί αργότερα με καλύτερη εκτύπωση.** Η περικοπή στην κονσόλα ήταν το
 * ορατό σύμπτωμα· η απώλεια στο parse ήταν η αιτία. Ίδιο σχήμα με το ADR-757
 * §7.2, όπου το `measure()` πετούσε το stdout του tsc και η πύλη έμεινε κόκκινη
 * 13 εκτελέσεις χωρίς κανείς να μπορεί να πει γιατί.
 *
 * ── ΔΥΟ ΔΙΑΛΕΚΤΟΙ ΓΙΑ ΤΟ ΙΔΙΟ ΕΡΩΤΗΜΑ (μετρημένο 09/08) ─────────────────────
 * Τρεις πύλες ξοδεύουν έναν μεταγλωττιστή· **δύο** διαβάζουν διαγνωστικά, με
 * διαφορετικό ορισμό του τι είναι διαγνωστικό:
 *   check-dxf-tsc-ratchet.js   αγκυρωμένο regex `αρχείο(γρ,στ): error TSxxxx:`
 *   enterprise-ts-gate.js      `line.includes('error TS')` — **υποσυμβολοσειρά**,
 *                              που πιάνει και σχόλιο πηγαίου κώδικα μέσα σε
 *                              μήνυμα σφάλματος, και μετρά **γραμμές** αντί για
 *                              διαγνωστικά.
 * Αυτό είναι το σχήμα του ADR-749 (τέσσερις μηχανές, πέντε διάλεκτοι, τρεις
 * αριθμοί) σε μικρογραφία. ⚠️ Το `enterprise-ts-gate.js` **ΔΕΝ** μετακομίζει εδώ
 * σε αυτό το βήμα, και ο λόγος είναι γραμμένος: η baseline του είναι **ωμό
 * πλήθος γραμμών**, άρα αλλαγή διαλέκτου αλλάζει τον **αριθμό** του έναντι της
 * ίδιας του της baseline ⇒ θέλει μετρημένο reseed, που απαγορεύεται χωρίς
 * εντολή. Καταγράφηκε στο `.claude-rules/pending-ratchet-work.md`.
 *
 * ── ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ (πρότυπο CHECK 3.39/3.42/3.46) ────────────────────────
 * **Κάθε** γραμμή της εξόδου προσγειώνεται σε **ονομασμένο κάδο** και το άθροισμα
 * πρέπει να κλείνει. Ο κάδος `unrecognised` **δεν μπλοκάρει** (θα κοκκίνιζε η
 * πύλη για θόρυβο του npm — ακριβώς η κλάση «αποτυχία για λάθος λόγο κρύβει τον
 * σωστό»), αλλά **αναφέρεται με δείγματα**: αν μια μελλοντική έκδοση του tsc
 * αλλάξει μορφή, ο μόνος τρόπος να μη διαβαστεί ως «λιγότερα σφάλματα, μπράβο»
 * είναι να φωνάζει ότι υπάρχουν γραμμές που κανείς δεν κατάλαβε.
 *
 * ⚠️ Η ΣΕΙΡΑ ταξινόμησης είναι συμβόλαιο: το αγκυρωμένο διαγνωστικό κρίνεται
 * ΠΡΙΝ το καθολικό, και η συνέχεια (continuation) **μόνο** αφού έχει ήδη
 * εμφανιστεί διαγνωστικό — αλλιώς κάθε γραμμή με εσοχή πριν το πρώτο σφάλμα
 * (θόρυβος εργαλείων) θα γινόταν σιωπηλά «συνέχεια» και θα εξαφανιζόταν.
 */

'use strict';

/**
 * Το ΜΟΝΟ σχήμα που εκπέμπει ο tsc ανά σφάλμα με `--pretty false`:
 *   `path/to/file.ts(12,34): error TS2345: μήνυμα`
 * Αντιγράφηκε **αυτούσιο** από το check-dxf-tsc-ratchet.js ώστε το πλήθος ανά
 * αρχείο να μένει **ταυτόσημο** με ό,τι κλείδωσε η baseline (άγκυρα `Κ1`).
 */
const TSC_DIAGNOSTIC_RE = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s*(.*)$/;

/**
 * Διαγνωστικό **χωρίς αρχείο**: σφάλματα διαμόρφωσης (`TS5083 Cannot read file
 * tsconfig.json`, `TS18003 No inputs were found`). Δεν έχουν αρχείο να χρεωθούν,
 * άρα **δεν μπορούν να μπουν σε per-file ratchet** — και γι' αυτό ακριβώς
 * πρέπει να έχουν όνομα: αλλιώς ένα σπασμένο tsconfig διαβάζεται ως «0 σφάλματα».
 */
const TSC_GLOBAL_RE = /^(error|warning)\s+(TS\d+):\s*(.*)$/;

/** Οι γραμμές σύνοψης του ίδιου του tsc — μετριούνται, δεν είναι διαγνωστικά. */
const TSC_SUMMARY_RE = /^Found \d+ errors?(?: in \d+ files?)?\.?$/;

/** Οι ονομασμένοι κάδοι. Ό,τι δεν ταιριάζει παίρνει όνομα εδώ — καμία σιωπηλή απόρριψη. */
const LINE_CLASS = Object.freeze({
  BLANK: 'blank',
  DIAGNOSTIC: 'diagnostic',
  NON_ERROR: 'non-error-diagnostic',
  GLOBAL: 'global-diagnostic',
  SUMMARY: 'summary',
  CONTINUATION: 'continuation',
  UNRECOGNISED: 'unrecognised',
});

/** Πόσα δείγματα κρατάμε ανά κάδο — αρκετά για διάγνωση, όχι τόσα ώστε να γίνει dump. */
const SAMPLE_LIMIT = 5;

/**
 * Πότε μια αταξινόμητη γραμμή είναι **ΕΠΙΚΙΝΔΥΝΗ** και όχι απλώς θόρυβος.
 *
 * Το `unrecognised` δεν είναι από μόνο του σήμα: το `npx` τυπώνει `npm info using
 * npm@10.8.2` σε κάθε εκτέλεση, οπότε ένα ⚠️ πάνω στο σκέτο πλήθος θα άναβε
 * **πάντα** — και μια προειδοποίηση που ανάβει πάντα εκπαιδεύει τον αναγνώστη να
 * την αγνοεί. Αυτό είναι το alert fatigue του ADR-757, αναπαραγμένο **μέσα** στο
 * όργανο που φτιάχτηκε για να το θεραπεύσει.
 *
 * Επικίνδυνη είναι η γραμμή που **μοιάζει με διαγνωστικό αλλά δεν διαβάστηκε** —
 * δηλαδή φέρει κωδικό `TSxxxx`. Αυτή ακριβώς είναι η υπογραφή «άλλαξε η μορφή του
 * tsc», όπου ο μετρητής πέφτει και η πτώση διαβάζεται ως πρόοδος. Ο θόρυβος του
 * npm δεν φέρει ποτέ κωδικό TS, άρα το κριτήριο δεν χρειάζεται λίστα εργαλείων
 * (που θα απέκλινε σιωπηλά — σχήμα CHECK 3.34/3.37).
 */
const SUSPICIOUS_UNRECOGNISED_RE = /\bTS\d{4}\b/;

function pushSample(list, value) {
  if (list.length < SAMPLE_LIMIT) list.push(value);
}

/**
 * Ταξινομεί ΜΙΑ γραμμή. Καθαρή συνάρτηση — κάθε κλάδος ελέγχεται χωρίς να
 * ξοδευτεί μεταγλωττιστής (η μόνη διέξοδος από τον N.17: ο πράκτορας δεν τρέχει
 * `tsc`, άρα κάθε απόφαση εδώ πρέπει να αποδεικνύεται με σταθερό κείμενο).
 *
 * @param {string} line
 * @param {boolean} seenDiagnostic είχε ήδη εμφανιστεί διαγνωστικό πριν από αυτή;
 * @returns {{ klass: string, diagnostic?: object }}
 */
function classifyLine(line, seenDiagnostic) {
  if (!line.trim()) return { klass: LINE_CLASS.BLANK };

  const anchored = TSC_DIAGNOSTIC_RE.exec(line);
  if (anchored) {
    const [, file, ln, col, category, code, message] = anchored;
    const diagnostic = {
      file: file.trim(),
      line: Number(ln),
      column: Number(col),
      category,
      code,
      message: message.trim(),
    };
    return {
      klass: category === 'error' ? LINE_CLASS.DIAGNOSTIC : LINE_CLASS.NON_ERROR,
      diagnostic,
    };
  }

  const global = TSC_GLOBAL_RE.exec(line);
  if (global) {
    const [, category, code, message] = global;
    return {
      klass: LINE_CLASS.GLOBAL,
      diagnostic: { file: null, line: null, column: null, category, code, message: message.trim() },
    };
  }

  if (TSC_SUMMARY_RE.test(line.trim())) return { klass: LINE_CLASS.SUMMARY };
  if (seenDiagnostic && /^\s+\S/.test(line)) return { klass: LINE_CLASS.CONTINUATION };
  return { klass: LINE_CLASS.UNRECOGNISED };
}

function emptyLedger() {
  const counts = {};
  for (const klass of Object.values(LINE_CLASS)) counts[klass] = 0;
  return counts;
}

/**
 * Διαβάζει ΟΛΗ την έξοδο του tsc με κλειστή λογιστική.
 *
 * @param {string} text
 * @returns {{
 *   errors: object[], nonErrors: object[], global: object[],
 *   ledger: Record<string, number>, totalLines: number,
 *   unrecognisedSamples: string[], balanced: boolean
 * }}
 */
function parseDiagnostics(text) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  const ledger = emptyLedger();
  const errors = [];
  const nonErrors = [];
  const globals = [];
  const unrecognisedSamples = [];
  const suspiciousSamples = [];
  let unrecognisedSuspicious = 0;
  let seenDiagnostic = false;

  for (const line of lines) {
    const { klass, diagnostic } = classifyLine(line, seenDiagnostic);
    // Άγνωστη κατάσταση ⇒ θάνατος με ΟΝΟΜΑ. Χωρίς αυτό, ένα τυπογραφικό σε νέο
    // κάδο θα έκανε `ledger[klass]` NaN και η γραμμή θα εξαφανιζόταν — δηλαδή ο
    // φρουρός της λογιστικής θα χανόταν ο ΙΔΙΟΣ σιωπηλά (μάθημα CHECK 3.39/Κ15β).
    if (!(klass in ledger)) throw new Error(`tsc-diagnostics: άγνωστη κατάσταση γραμμής "${klass}"`);
    ledger[klass] += 1;
    if (klass === LINE_CLASS.DIAGNOSTIC) {
      errors.push(diagnostic);
      seenDiagnostic = true;
    } else if (klass === LINE_CLASS.NON_ERROR) {
      nonErrors.push(diagnostic);
      seenDiagnostic = true;
    } else if (klass === LINE_CLASS.GLOBAL) {
      globals.push(diagnostic);
    } else if (klass === LINE_CLASS.UNRECOGNISED) {
      pushSample(unrecognisedSamples, line.trim());
      if (SUSPICIOUS_UNRECOGNISED_RE.test(line)) {
        unrecognisedSuspicious += 1;
        pushSample(suspiciousSamples, line.trim());
      }
    }
  }

  const accounted = Object.values(ledger).reduce((a, b) => a + b, 0);
  if (accounted !== lines.length) {
    // Δομικά αδύνατο (κάθε γραμμή παίρνει ακριβώς έναν κάδο) — αλλά η λογιστική
    // που δεν ελέγχει τον εαυτό της είναι ακριβώς ο φρουρός που χάνεται σιωπηλά.
    throw new Error(`tsc-diagnostics: η λογιστική δεν κλείνει (${accounted} ≠ ${lines.length})`);
  }

  return {
    errors,
    nonErrors,
    global: globals,
    ledger,
    totalLines: lines.length,
    unrecognisedSamples,
    unrecognisedSuspicious,
    suspiciousSamples,
    balanced: true,
  };
}

/**
 * Πλήθος σφαλμάτων ανά αρχείο — το σχήμα που κλειδώνει η baseline του 3.29.
 * Τα κλειδιά βγαίνουν κανονικοποιημένα από τον καλούντα (κάθε πύλη έχει τη δική
 * της ρίζα), γι' αυτό η κανονικοποίηση περνιέται ως συνάρτηση αντί να μαντευτεί.
 *
 * @param {object[]} diagnostics
 * @param {(file: string) => string} normalize
 * @returns {Record<string, number>} με ταξινομημένα κλειδιά (σταθερό diff baseline)
 */
function countByFile(diagnostics, normalize = (f) => f) {
  const byFile = {};
  for (const d of diagnostics) {
    if (!d.file) continue; // καθολικό διαγνωστικό — δεν χρεώνεται σε αρχείο
    const key = normalize(d.file);
    byFile[key] = (byFile[key] || 0) + 1;
  }
  const sorted = {};
  for (const k of Object.keys(byFile).sort()) sorted[k] = byFile[k];
  return sorted;
}

/**
 * Η απογραφή ανά κωδικό TS — **το όργανο που απαντά το ερώτημα της διάγνωσης**.
 * Ταξινομημένη κατά πλήθος φθίνουσα, με δείγμα μηνύματος και θέσης ώστε ο
 * αναγνώστης να μη χρειάζεται να ανοίξει αρχείο για να καταλάβει τι είδε.
 *
 * @param {object[]} diagnostics
 * @returns {{code:string,count:number,files:number,sampleMessage:string,sampleSite:string}[]}
 */
function censusByCode(diagnostics) {
  const byCode = new Map();
  for (const d of diagnostics) {
    let entry = byCode.get(d.code);
    if (!entry) {
      entry = { code: d.code, count: 0, files: new Set(), sampleMessage: d.message, sampleSite: null };
      byCode.set(d.code, entry);
    }
    entry.count += 1;
    if (d.file) {
      entry.files.add(d.file);
      if (!entry.sampleSite) entry.sampleSite = `${d.file}:${d.line}:${d.column}`;
    }
  }
  return [...byCode.values()]
    .map((e) => ({
      code: e.code,
      count: e.count,
      files: e.files.size,
      sampleMessage: e.sampleMessage,
      sampleSite: e.sampleSite || '(χωρίς αρχείο)',
    }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

/**
 * Ο ΔΙΑΚΡΙΤΗΣ των δύο υποθέσεων του handoff, ως **μέτρηση και όχι ως συμπέρασμα**:
 *
 *   Υ1 «ένα ριζικό αίτιο που διαχέεται» ⇒ λίγοι κωδικοί, μεγάλο μερίδιο κορυφής.
 *   Υ2 «συσσώρευση εβδομάδων»           ⇒ πολλοί κωδικοί, μικρό μερίδιο κορυφής.
 *
 * ⚠️ Επιστρέφει **αριθμούς**, όχι ετυμηγορία. Μια πύλη που αποφασίζει μόνη της
 * «είναι το Υ1» θα έχει δίκιο μέχρι την πρώτη φορά που δεν έχει, και τότε κανείς
 * δεν θα ξέρει ότι δεν έχει.
 *
 * @param {object[]} diagnostics
 */
function concentration(diagnostics) {
  const census = censusByCode(diagnostics);
  const total = diagnostics.length;
  const top = census[0] || null;
  return {
    total,
    distinctCodes: census.length,
    topCode: top ? top.code : null,
    topCount: top ? top.count : 0,
    topShare: total > 0 && top ? Number((top.count / total).toFixed(4)) : 0,
    topFiles: top ? top.files : 0,
  };
}

module.exports = {
  TSC_DIAGNOSTIC_RE,
  TSC_GLOBAL_RE,
  TSC_SUMMARY_RE,
  LINE_CLASS,
  SAMPLE_LIMIT,
  SUSPICIOUS_UNRECOGNISED_RE,
  classifyLine,
  parseDiagnostics,
  countByFile,
  censusByCode,
  concentration,
};
