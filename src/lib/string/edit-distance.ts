/**
 * @fileoverview **ΑΠΟΣΤΑΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ — Η ΜΙΑ ΥΛΟΠΟΙΗΣΗ.** Levenshtein ή Damerau (OSA), φραγμένη.
 * @module lib/string/edit-distance
 * @related ADR-883 §5.11 · `lib/geo/admin-area-vocabulary.ts` · `lib/places/admin-name-index.ts` ·
 *          `lib/string/fuzzy-greek.ts` · `subapps/accounting/services/engines/matching-scoring.ts`
 *
 * 🔑 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (SSoT audit ADR-883, 2026-09-25)**: ζούσαν **τρεις** υλοποιήσεις — μία
 * ιδιωτική Levenshtein στο `fuzzy-greek`, μία εξαγόμενη στη λογιστική, και ένας φραγμένος έλεγχος
 * «Damerau ≤ 1» στο ευρετήριο ονομάτων. Η αναζήτηση περιοχών χρειαζόταν **τέταρτη** (πρόθεμα +
 * μετάθεση + όριο). Αντί γι' αυτό: μία μηχανή, και οι τρεις παλιές την καλούν.
 *
 * - **Μετάθεση** (`transpositions`): Damerau «optimal string alignment» — «ΘΕΣΑΛΝΟΙΚΗ» είναι
 *   **ένα** λάθος, όχι δύο (Algolia, Elasticsearch: προεπιλογή). Χωρίς αυτή: καθαρή Levenshtein.
 * - **Όριο** (`max`): η ερώτηση σχεδόν πάντα είναι «≤ k;». Η σάρωση σταματά μόλις **όλη** η γραμμή
 *   ξεπεράσει το όριο (το ελάχιστο γραμμής δεν μειώνεται ποτέ, ούτε με μετάθεση: `D[i][j] ≥ D[i-1][j-1]`).
 *   Πάνω από το όριο επιστρέφεται `max + 1` — «πολύ μακριά», όχι ο ακριβής αριθμός.
 *
 * ⚠️ **Φύλλο χωρίς ΚΑΜΙΑ εισαγωγή** — το διαβάζει και ο γεννήτορας ορίων (`tsx`, χωρίς alias).
 * ⚠️ Συγκρίνει **μονάδες UTF-16** — τα ελληνικά/λατινικά είναι όλα στο BMP. Η κανονικοποίηση
 *    (τόνοι, πεζά, `ς`) είναι δουλειά του καλούντος.
 */

export interface EditDistanceOptions {
  /** Η μετάθεση δύο γειτονικών γραμμάτων μετρά ένα λάθος (Damerau/OSA). Προεπιλογή: `false`. */
  readonly transpositions?: boolean;
  /** Άνω όριο — πάνω από αυτό επιστρέφεται `max + 1`. Προεπιλογή: χωρίς όριο. */
  readonly max?: number;
}

/**
 * 🔑 **Τρεις γραμμές, επαναχρησιμοποιούμενες** — η ανοχή ορθογραφίας ρωτά χιλιάδες λέξεις ανά πάτημα
 * πλήκτρου· ένας νέος πίνακας ανά κλήση ήταν το μισό κόστος (μετρημένο, ADR-883 §5.11). Ασφαλές
 * επειδή η JavaScript είναι μονονηματική και κανένας καλών δεν κρατά τη γραμμή μετά την επιστροφή.
 */
let rows: [Int32Array, Int32Array, Int32Array] = [new Int32Array(32), new Int32Array(32), new Int32Array(32)];

function rowsFor(length: number): [Int32Array, Int32Array, Int32Array] {
  if (rows[0].length < length) rows = [new Int32Array(length * 2), new Int32Array(length * 2), new Int32Array(length * 2)];
  return rows;
}

/**
 * Η τελευταία γραμμή του πίνακα: `row[j]` = απόσταση του `a` από το **πρόθεμα** `b[0..j)`.
 * `null` όταν όλη κάποια γραμμή ξεπέρασε το όριο (καμία στήλη δεν μπορεί πια να το πιάσει).
 * ⚠️ Η γραμμή είναι **κοινόχρηστη** — διάβασέ την πριν την επόμενη κλήση.
 */
function lastRow(a: string, b: string, transpositions: boolean, max: number): Int32Array | null {
  let [before, previous, current] = rowsFor(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (transpositions && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1);
      }
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return null;
    [before, previous, current] = [previous, current, before];
  }
  return previous;
}

/** Απόσταση επεξεργασίας ανάμεσα σε δύο **ολόκληρες** λέξεις. */
export function editDistance(a: string, b: string, options: EditDistanceOptions = {}): number {
  const max = options.max ?? Number.POSITIVE_INFINITY;
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const row = lastRow(a, b, options.transpositions ?? false, max);
  const distance = row === null ? max + 1 : row[b.length];
  return distance > max ? max + 1 : distance;
}

/**
 * **Απόσταση από ΠΡΟΘΕΜΑ** — πόσα λάθη χωρίζουν το `query` από την **αρχή** του `target`.
 * Είναι η ερώτηση της αυτόματης συμπλήρωσης: ο άνθρωπος δεν έχει τελειώσει τη λέξη
 * («Ξυλουπ» ⇒ «Ξυλόπολη» με ένα λάθος). Πάντα με μετάθεση.
 *
 * @param minPrefixLength Το μικρότερο πρόθεμα του `target` που μετρά — `target.length` σημαίνει
 *        «ολόκληρη λέξη», `target.length − 4` «ολόκληρη εκτός από κατάληξη ως 4 γράμματα».
 */
export function prefixEditDistance(query: string, target: string, max: number, minPrefixLength = 0): number {
  if (target.startsWith(query) && query.length >= minPrefixLength) return 0;
  const row = lastRow(query, target, true, max);
  if (row === null) return max + 1;
  let best = max + 1;
  for (let j = Math.max(0, minPrefixLength); j <= target.length; j += 1) best = Math.min(best, row[j]);
  return best;
}
