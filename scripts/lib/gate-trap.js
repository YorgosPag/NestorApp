/**
 * **Η ΖΩΝΗ ΑΣΦΑΛΕΙΑΣ ΤΗΣ ΟΨΗΣ ΤΟΥ COMMIT** (ADR-924 Φ4, §8.5) — μια ΠΑΓΙΔΑ, όχι επικάλυψη.
 *
 * Σε worker πύλης που ζήτησε `--index`: κάθε ωμή ανάγνωση `fs` αρχείου του repo που **ΔΕΝ θα δεσμευτεί όπως είναι στον
 * δίσκο** (αποκλίνει από το ευρετήριο ή είναι untracked) **καταγράφεται με όνομα** και η πύλη αποτυγχάνει. Η είσοδος της
 * πύλης (`gate-input`) δεν διαβάζει ΠΟΤΕ τέτοιο αρχείο από τον δίσκο (το παίρνει ως blob) — άρα κάθε σύλληψη είναι
 * πραγματική διαρροή: κάποιος κρίνει την ξένη αστάδιοποίητη δουλειά αντί για το commit.
 *
 * ❌ ΑΠΟΡΡΙΦΘΗΚΕ (§5, εναλλακτική Δ): σιωπηλή ΑΝΤΙΚΑΤΑΣΤΑΣΗ του κειμένου κάτω από την πύλη. Η παγίδα ΔΕΝ αλλάζει τι
 *    διαβάζεται — επιστρέφει ό,τι θα επέστρεφε το `fs` — απλώς το ΛΕΕΙ. Η θεραπεία μένει ρητή: η πύλη ρωτά την είσοδο.
 *
 * Εξαιρούνται: (α) ό,τι φορτώνει ο φορτωτής modules του Node (ο κώδικας που ΕΚΤΕΛΕΙΤΑΙ — δηλωμένο όριο §4.2)·
 * (β) οι **δηλωμένες αναγνώσεις περιβάλλοντος** της πύλης (`.gate-commit-view.json` → `environment`, με λόγο).
 *
 * @module scripts/lib/gate-trap
 */

'use strict';

const path = require('node:path');

/** Οι αναγνώστες ΑΡΧΕΙΩΝ του `fs` που παρακολουθούνται (ο `readdirSync` λιστάρει φάκελο — δεν κρίνει κείμενο). */
const TRAPPED_READERS = Object.freeze(['readFileSync', 'existsSync', 'statSync', 'lstatSync', 'openSync']);

/**
 * Η ανάγνωση έγινε από τον φορτωτή modules (require) — κώδικας που εκτελείται, όχι δεδομένα που κρίνονται.
 * ⚠️ Κρίνεται ο **ΑΜΕΣΟΣ** καλών (η γραμμή μετά το πλαίσιο της παγίδας), όχι «υπάρχει κάπου στη στοίβα»: ο worker τρέχει
 *    την πύλη ΜΕΣΑ στη φόρτωση του δικού του module, άρα κάθε στοίβα περιέχει `node:internal/modules` (μετρημένο, Ω8).
 */
function isModuleLoaderRead(stack) {
  return /node:internal\/modules\//.test(callerOf(stack));
}

/** Ο άμεσος καλών της ανάγνωσης (η γραμμή μετά το πλαίσιο της παγίδας) — μπαίνει στην αναφορά: ΠΟΙΟΣ διάβασε. */
function callerOf(stack) {
  return (String(stack).split('\n')[2] || '').trim().replace(/^at\s+/, '');
}

/**
 * Το σχετικό posix μονοπάτι ενός ορίσματος του `fs` μέσα στη ρίζα — ή `null` (εκτός repo, file descriptor, Buffer/URL).
 * @param {string} root
 * @param {unknown} target
 */
function repoRelative(root, target) {
  if (typeof target !== 'string') return null;
  const rel = path.relative(root, path.resolve(root, target)).split(path.sep).join('/');
  return rel === '' || rel.startsWith('..') || path.isAbsolute(rel) ? null : rel;
}

/** Οι αναγνώστες ΠΡΙΝ την παγίδα — για τις ρητές αναγνώσεις «κώδικα που τρέχει» παρακάτω. */
const UNTRAPPED = {};

/**
 * **Ο ΚΩΔΙΚΑΣ ΠΟΥ ΤΡΕΧΕΙ** — ρητή, ονομασμένη ανάγνωση που η παγίδα ΔΕΝ μετρά: ο δίσκος είναι εδώ η σωστή πηγή, γιατί
 * από αυτόν εκτελείται ο κώδικας (δηλωμένο όριο §4.2 — ίδια κατηγορία με τη φόρτωση modules). Χρήση: αποτυπώματα/κλειδιά
 * cache του ΙΔΙΟΥ του toolchain (π.χ. i18n shell slice). ⚠️ ΠΟΤΕ για δεδομένα που κρίνει μια πύλη — εκείνα από την είσοδο.
 * Λύνεται ως μονοπάτι κώδικα, όχι λίστα: το σημείο που διαβάζει δηλώνει το ίδιο ΤΙ διαβάζει.
 */
function readRunningCode(file) {
  return (UNTRAPPED.readFileSync || require('node:fs').readFileSync)(file, 'utf8');
}
/** Το ίδιο για ύπαρξη αρχείου κώδικα (επίλυση `require` του toolchain). */
function isRunningCodeFile(file) {
  return (UNTRAPPED.statSync || require('node:fs').statSync)(file, { throwIfNoEntry: false })?.isFile() === true;
}

/**
 * Στήνει την παγίδα στο `fs` της διεργασίας (worker = μία πύλη). Επιστρέφει τις συλλήψεις (ζωντανός πίνακας).
 * @param {object} fs το `node:fs` του worker
 * @param {{root: string, suspect: Iterable<string>, exempt?: Iterable<string>}} options
 *   `suspect` = σχετικά μονοπάτια που ο δίσκος ΔΕΝ ταυτίζεται με το commit (αποκλίνοντα + untracked)·
 *   `exempt` = οι δηλωμένες αναγνώσεις περιβάλλοντος της πύλης
 * @returns {Array<{reader: string, file: string}>}
 */
function installReadTrap(fs, { root, suspect, exempt = [] }) {
  const watched = new Set(suspect);
  const declared = new Set(exempt);
  const caught = [];
  const seen = new Set();
  for (const reader of TRAPPED_READERS) {
    const original = fs[reader];
    UNTRAPPED[reader] = original;
    fs[reader] = function trapped(target, ...rest) {
      const rel = repoRelative(root, target);
      if (rel && watched.has(rel) && !declared.has(rel) && !seen.has(`${reader}:${rel}`)) {
        const stack = new Error().stack;
        if (!isModuleLoaderRead(stack)) {
          seen.add(`${reader}:${rel}`);
          caught.push({ reader, file: rel, by: callerOf(stack) });
        }
      }
      return original.call(this, target, ...rest);
    };
  }
  return caught;
}

/**
 * Η κρίση του γονέα πάνω στο κατάστιχο ενός worker: πύλη με `--index` που (α) άνοιξε είσοδο ΔΙΣΚΟΥ στη ρίζα του repo
 * ή (β) διάβασε ωμά αρχείο που δεν θα δεσμευτεί όπως είναι. Κενός πίνακας ⇒ η όψη του commit έφτασε όπου ρωτήθηκε.
 * @param {{opened?: Array<{mode: string, root: string}>, trapped?: Array<{reader: string, file: string}>}} record
 * @param {string} root η ρίζα του repo
 * @returns {string[]} τα ευρήματα, έτοιμα για αναφορά
 */
function judgeLedger(record, root) {
  const repo = path.resolve(root).split(path.sep).join('/').toLowerCase();
  const findings = [];
  const diskOpenings = (record.opened || []).filter(entry => entry.mode === 'disk' && entry.root.toLowerCase() === repo);
  if (diskOpenings.length > 0) {
    findings.push(`άνοιξε ${diskOpenings.length} είσοδο/ους ΔΙΣΚΟΥ ενώ ζήτησε \`--index\` — κάποια βιβλιοθήκη δεν πήρε την είσοδο `
      + '(προεπιλογή «δίσκος» σε παράμετρο που δεν δόθηκε)');
  }
  for (const { reader, file, by } of record.trapped || []) {
    findings.push(`ωμό \`fs.${reader}\` στο ${file} — ο δίσκος ΔΕΝ είναι το commit εδώ (αποκλίνει ή είναι untracked)`
      + (by ? `\n       από: ${by}` : ''));
  }
  return findings;
}

module.exports = {
  TRAPPED_READERS, installReadTrap, judgeLedger, repoRelative, isModuleLoaderRead, callerOf, readRunningCode, isRunningCodeFile,
};
