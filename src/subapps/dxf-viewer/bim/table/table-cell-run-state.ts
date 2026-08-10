/**
 * 🔴 ADR-753 — **ΤΙ ΔΕΙΧΝΕΙ ΕΝΑ ΧΕΙΡΙΣΤΗΡΙΟ ΓΙΑ ΑΥΤΑ ΤΑ ΓΡΑΜΜΑΤΑ.** Η ανάγνωση των runs,
 * χωρίς καμία εγγραφή.
 *
 * ## Γιατί χωριστό αρχείο (Φ4, N.7.1)
 * Ήταν η ενότητα «Ανάγνωση» του `table-cell-run-ops.ts`. Η Φ4 πρόσθεσε τον **δεύτερο**
 * αναγνώστη ({@link cellRunNumericRange}) και το αρχείο πέρασε τις **500 γραμμές**. Η τομή δεν
 * είναι αυθαίρετη — είναι η ίδια που ήδη ονόμαζαν οι δύο επικεφαλίδες του:
 *
 * ```
 *   table-cell-run-ops.ts    →  ΠΩΣ ΑΛΛΑΖΕΙ η μορφοποίηση των χαρακτήρων
 *   table-cell-run-state.ts  →  ΤΙ ΙΣΧΥΕΙ σε αυτούς  ── ΕΔΩ ──
 * ```
 *
 * Είναι και η **ίδια** διαίρεση που έχει ήδη ένα επίπεδο έξω ο πίνακας: εκεί η ανάγνωση
 * («συμφωνούν τα κελιά;») ζει στο `table-cell-style-scan.ts`, κοινή για άξονα και περιοχή, ενώ
 * οι γραφείς είναι χωριστοί. Δύο επίπεδα, ίδιος άξονας τομής.
 *
 * ## 🔴 Η ΜΗΧΑΝΙΚΗ ΔΕΝ ΔΙΠΛΑΣΙΑΣΤΗΚΕ
 * Το ξεδίπλωμα ({@link expandStyles}) και ο κανόνας «πού κοιτά ο δρομέας»
 * ({@link effectiveRange}) εισάγονται από τον γραφέα. Ένα αντίγραφό τους εδώ θα σήμαινε ότι το
 * κουμπί **δείχνει** την κατάσταση ενός χαρακτήρα και **γράφει** σε άλλον — απόκλιση ορατή μόνο
 * με τον δρομέα σε ένα συγκεκριμένο σημείο, δηλαδή σχεδόν ποτέ.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-run-state
 * @see bim/table/table-cell-run-ops.ts — ο γραφέας και η μία μηχανική
 * @see bim/table/table-cell-style-scan.ts — η ίδια ερώτηση ένα επίπεδο έξω (κελιά)
 */

import {
  clampRange,
  effectiveRange,
  expandStyles,
  type TableTextRange,
  type TableTextRunNumericKey,
  type TableTextRunStyleKey,
} from './table-cell-run-ops';
import type { TableFormatState, TableNumericRange } from './table-cell-style-scan';
import type { TableCellTextRun, TableTextRunStyle } from '../../types/table';

/**
 * Τι δείχνει ένα χειριστήριο του toolbar για την **τρέχουσα επιλογή**.
 *
 * 🔴 Το `inherited` δεν είναι ευκολία — είναι η διαφορά ανάμεσα στην αλήθεια και στο ψέμα.
 * Διαβάζοντας **μόνο** τα runs, το κουμπί θα έλεγε «όχι έντονα» για επιλογή μέσα σε κελί που
 * το **στυλ** του γράφει έντονο: δηλαδή θα διέψευδε ό,τι βλέπει ο χρήστης στην οθόνη. Είναι
 * ακριβώς το μάθημα που είναι ήδη γραμμένο στο `resolveAxisFormat` — και ο λόγος που εκείνο
 * διατρέχει τα επιλυμένα στυλ αντί για τις παρακάμψεις.
 *
 * Το σχήμα απόκρισης είναι το **ίδιο** {@link TableFormatState} κάθε χειριστηρίου, όχι δίδυμό
 * του: οι τρεις ερωτήσεις («τι ισχύει / συμφωνούν; / ποιος το είπε;») είναι οι ίδιες τρεις, και
 * δύο σχήματα θα ήταν ο structural clone που πιάνει το CHECK 3.28 ανεξάρτητα ονομάτων (N.18).
 *
 * ## Κενή επιλογή = ο δρομέας
 * `start === end` (κέρσορας χωρίς επιλογή) απαντά για τον χαρακτήρα **αριστερά** — ίδιος
 * κανόνας με τη μετατόπιση, ώστε «τι θα πάρει ό,τι γράψω τώρα» και «τι δείχνει το κουμπί» να
 * είναι η ίδια απάντηση. Δύο κανόνες εδώ θα σήμαιναν κουμπί που δεν προβλέπει το αποτέλεσμά του.
 *
 * ## 🔴 ADR-753 Φ4 — το `inherited` επιτρέπεται να είναι `undefined`, και ο μετρητής άλλαξε
 * Η πρώτη γραφή απαιτούσε `NonNullable`, γιατί ο μόνος υποθετικός καλών ήταν τα δίτιμα. Το
 * χειριστήριο της Φ4 ρωτά και για **`fontFamily`**, που στο επιλυμένο στυλ του κελιού είναι
 * νόμιμα απόν («η προεπιλογή του καμβά»). Μαζί με τη διεύρυνση έπρεπε να αλλάξει και ο
 * φρουρός: το `value === undefined` σήμαινε ταυτόχρονα «κανένας χαρακτήρας» **και** «η
 * κληρονομιά δεν λέει τίποτα» — δύο καταστάσεις με **αντίθετη** σωστή απάντηση. Μετρά πλέον
 * ρητά αν κοιτάχτηκε έστω ένας χαρακτήρας.
 */
export function resolveCellRunFormat<K extends TableTextRunStyleKey>(
  runs: readonly TableCellTextRun[] | undefined,
  textLength: number,
  range: TableTextRange,
  key: K,
  inherited: TableTextRunStyle[K],
): TableFormatState<TableTextRunStyle[K]> {
  const styles = expandStyles(runs, textLength);
  const { from, to } = effectiveRange(range, textLength);

  let value: TableTextRunStyle[K] | undefined;
  let seen = false;
  let overridden = false;
  let mixed = false;

  for (let i = from; i < to; i += 1) {
    const declared = styles[i]?.[key];
    const current = declared ?? inherited;
    if (declared !== undefined) overridden = true;
    if (!seen) {
      value = current;
      seen = true;
    } else if (current !== value) mixed = true;
  }

  // Εύρος εκτός κειμένου (κενό κελί, μπαγιάτικη επιλογή): κληρονομιά, τίποτα ρητό.
  if (!seen) return { value: inherited, mixed: false, overridden: false };
  return { value: mixed ? undefined : value, mixed, overridden };
}

/**
 * 🔴 ADR-753 Φ4 — **τα άκρα μιας αριθμητικής ιδιότητας πάνω σε ΧΑΡΑΚΤΗΡΕΣ.**
 *
 * Ο αδελφός του `resolveCellsNumericRange` ένα επίπεδο πιο μέσα: εκείνο απαντά «από πού
 * ξεκινά το `A↑` για αυτά τα **κελιά**», αυτό «για αυτά τα **γράμματα**». Το βήμα μεγέθους
 * χρειάζεται `min`/`max` και όχι «συμφωνούν;» — αλλιώς μια επιλογή με δύο διαφορετικά μεγέθη
 * δεν θα είχε αφετηρία και το κουμπί θα ήταν σιωπηλά ανενεργό.
 *
 * ⚠️ Ο κανόνας του **κενού** εύρους είναι ο ίδιος ({@link effectiveRange}), γραμμένος **μία**
 * φορά: δύο εκφράσεις του «πού κοιτά ο δρομέας» θα σήμαιναν ότι το κουμπί δείχνει την
 * κατάσταση ενός χαρακτήρα και γράφει σε άλλον.
 *
 * `null` όταν κανένας χαρακτήρας δεν κοιτάχτηκε (κενό κελί, μπαγιάτικη επιλογή) — ο καλών
 * σβήνει, ποτέ δεν μαντεύει αφετηρία.
 */
export function cellRunNumericRange<K extends TableTextRunNumericKey>(
  runs: readonly TableCellTextRun[] | undefined,
  textLength: number,
  range: TableTextRange,
  key: K,
  inherited: number,
): TableNumericRange | null {
  const styles = expandStyles(runs, textLength);
  const { from, to } = effectiveRange(range, textLength);

  let combined: TableNumericRange | null = null;
  for (let i = from; i < to; i += 1) {
    const current = (styles[i]?.[key] as number | undefined) ?? inherited;
    combined = combined === null
      ? { min: current, max: current }
      : { min: Math.min(combined.min, current), max: Math.max(combined.max, current) };
  }
  return combined;
}

/**
 * Δηλώνει το κελί **οτιδήποτε** ρητά σε αυτό το εύρος; Η ερώτηση της «Απαλοιφής».
 *
 * ⚠️ Χρησιμοποιεί το ωμό {@link clampRange} και **όχι** το {@link effectiveRange}, και είναι
 * σκόπιμο: η ερώτηση εδώ είναι «υπάρχει τι να **σβηστεί**», όχι «τι θα πάρει ό,τι γράψω τώρα».
 * Σκέτος δρομέας δεν έχει τι να σβήσει — μια πτώση στον χαρακτήρα αριστερά θα άναβε το κουμπί
 * «Απαλοιφή» για επιλογή που δεν υπάρχει.
 */
export function hasCellRunStyles(
  runs: readonly TableCellTextRun[] | undefined,
  textLength: number,
  range: TableTextRange,
): boolean {
  if (!runs || runs.length === 0) return false;
  const { start, end } = clampRange(range, textLength);
  return runs.some((run) => run.start < end && run.end > start);
}
