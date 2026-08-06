/**
 * ADR-739 Φ.Ε βήμα 5 — **η σκάλα του μεγέθους κειμένου** πίσω από τα `A↑` / `A↓` του mini
 * toolbar. Καθαρό· μηδέν React, μηδέν DOM.
 *
 * ## Γιατί σκάλα και όχι `+0.5mm`
 * Το «Αύξηση μεγέθους γραμματοσειράς» του Excel δεν προσθέτει σταθερό βήμα — ανεβαίνει σε
 * **προκαθορισμένα σκαλιά** (11 → 12 → 14 → 16 → 18 → 20 → 22 → 24 → 28 → 36 → 48 → 72), αραιά
 * στο πάνω άκρο. Ένα σταθερό βήμα δίνει είτε ανυπόφορα πολλά πατήματα στα μεγάλα μεγέθη είτε
 * ανεπίτρεπτα χοντρό βήμα στα μικρά.
 *
 * ## 🔴 Γιατί ΟΧΙ το `FONT_SIZES_RAW` του `dxf-settings` (μετρημένο, ADR-739 §28.8)
 * Το §28.8 άφηνε ανοιχτό το ερώτημα «ταιριάζει εννοιολογικά με sheet-mm;». **Δεν ταιριάζει**:
 * το `FONT_SIZES_RAW` είναι `[8…72]` σε **px** του browser, για τις γενικές ρυθμίσεις
 * εγγράφου· εδώ το μέγεθος είναι `textHeightMm` σε **sheet-mm** (DXF group code 140), δεμένο
 * στην κλίμακα σχεδίου (ADR-462/716). Δύο άσχετες μονάδες σε δύο άσχετα υποσυστήματα, χωρίς
 * μεταφραστή — ακριβώς η παγίδα που εκείνα τα ADR έκλεισαν. Το ερώτημα του §28.8 απαντήθηκε.
 *
 * ## Τι περιέχει η σκάλα — και γιατί ακριβώς αυτά
 * Δύο σύνολα, ενωμένα, ώστε κανένα από τα δύο να μη «σκοντάφτει» στο πρώτο πάτημα:
 *  1. **Οι έξι τιμές του ribbon** για ύψος κειμένου (`1 · 2.5 · 3.5 · 5 · 7 · 10`, ήδη σε mm,
 *     `quantityKind: 'paper-length'`) — αλλιώς πίνακας και κείμενο θα μιλούσαν διαφορετική
 *     γλώσσα για το ίδιο μέγεθος στο ίδιο σχέδιο.
 *  2. **Οι τρεις προεπιλογές των κλάσεων γραμμής** (`2.8` δεδομένα · `3` κεφαλίδα · `4` τίτλος)
 *     — χωρίς αυτές, το **πρώτο** `A↑` πάνω σε πίνακα προεπιλογής θα πηδούσε 2.8 → 3.5, δηλαδή
 *     **+25%** με ένα πάτημα, στο πιο συνηθισμένο σενάριο που υπάρχει.
 *
 * @module subapps/dxf-viewer/bim/table/table-text-height-scale
 * @see bim/table/table-axis-style-ops.ts — ποιος γράφει την τιμή στον άξονα
 * @see bim/table/table-style-presets.ts — από πού βγαίνουν οι τρεις προεπιλογές
 */

import {
  resolveAxisNumericRange,
  setAxisStyleField,
  type TableStyleAxis,
} from './table-axis-style-ops';
import type { TableNumericRange } from './table-cell-style-scan';
import type { TableStyle } from './table-style';
import type { PersistedTableModel } from '../../types/table';

/** Προς τα πού κινείται το μέγεθος. Το `+1` μεγαλώνει. */
export type TextHeightStepDirection = 1 | -1;

/**
 * Τα σκαλιά του ύψους κειμένου, σε **sheet-mm**, αύξουσα σειρά.
 *
 * ⚠️ Η σειρά **είναι** ο μηχανισμός: το {@link nextTextHeightStepMm} διαβάζει το πρώτο σκαλί
 * αυστηρά πάνω/κάτω από την τρέχουσα τιμή. Μια αταξινόμητη λίστα θα έδινε βήμα προς τα πίσω
 * χωρίς κανένα σφάλμα.
 */
export const TABLE_TEXT_HEIGHT_SCALE_MM: readonly number[] = [
  1, 1.5, 1.8, 2, 2.2, 2.5, 2.8, 3, 3.5, 4, 5, 6, 7, 8, 10,
];

/**
 * Το επόμενο σκαλί από το `current` προς την `direction` — ή **το ίδιο το `current`** όταν
 * δεν υπάρχει (είμαστε ήδη στο άκρο).
 *
 * Η επιστροφή της ίδιας τιμής στο άκρο δεν είναι αδιαφορία: ταξιδεύει ως no-op μέχρι το
 * `setAxisStyleField`, που συγκρίνει με `===` και επιστρέφει το **ίδιο μοντέλο**
 * by-reference ⇒ καμία εντολή, **κανένα βήμα undo** για ένα πάτημα που δεν άλλαξε τίποτα.
 *
 * Τιμή **εκτός** σκάλας (π.χ. `2.9` από παλιό αρχείο ή από άλλο στυλ) δεν είναι ειδική
 * περίπτωση: το «πρώτο αυστηρά μεγαλύτερο» την προσγειώνει φυσικά στο πλησιέστερο σκαλί.
 */
export function nextTextHeightStepMm(
  current: number,
  direction: TextHeightStepDirection,
): number {
  if (!Number.isFinite(current)) return current;
  const next = direction === 1
    ? TABLE_TEXT_HEIGHT_SCALE_MM.find((step) => step > current)
    : findLast(TABLE_TEXT_HEIGHT_SCALE_MM, (step) => step < current);
  return next ?? current;
}

/**
 * Ανεβάζει ή κατεβάζει ένα σκαλί το ύψος κειμένου **ολόκληρου** του άξονα.
 *
 * 🔴 **Από ποια τιμή ξεκινά όταν η σειρά είναι μεικτή** — και είναι μεικτή σχεδόν πάντα, γιατί
 * κάθε στήλη περνά από τίτλο (4mm), κεφαλίδα (3mm) και δεδομένα (2.8mm):
 *
 * ```
 *   μεγαλώνω  →  ξεκίνα από το ΜΕΓΙΣΤΟ   ·   μικραίνω  →  ξεκίνα από το ΕΛΑΧΙΣΤΟ
 * ```
 *
 * Έτσι το «μεγάλωσε» **δεν μικραίνει ποτέ** κανένα κελί της σειράς, και το «μίκρυνε» δεν
 * μεγαλώνει κανένα. Η αντίθετη επιλογή (ξεκίνα από το ελάχιστο και στις δύο) θα έκανε το
 * πρώτο «μεγάλωσε» πάνω σε στήλη με τίτλο 4mm να **συρρικνώσει τον τίτλο** στα 3mm — δηλαδή
 * το κουμπί θα έκανε το αντίθετο από το όνομά του, στο πιο ορατό κελί του πίνακα.
 *
 * Είναι η ίδια αρχή με το `nextBooleanFormat` («μεικτό ⇒ όλα ναι»): σε ασυμφωνία, διάλεξε την
 * κατεύθυνση που δίνει **ορατή αλλαγή προς τα εκεί που ζήτησε ο χρήστης**.
 *
 * ⚠️ Συνέπεια, ρητά αποδεκτή (Α2): μία παράκαμψη άξονα **ισοπεδώνει** την ιεραρχία μεγεθών
 * της σειράς — τίτλος, κεφαλίδα και δεδομένα αποκτούν το ίδιο ύψος. Είναι η φύση του μοντέλου
 * επιπέδου άξονα, όχι ελάττωμα εδώ· ο δρόμος επιστροφής είναι το «Επαναφορά στο στυλ»
 * ({@link clearAxisStyleOverride}), που το Excel δεν έχει καν.
 */
export function stepAxisTextHeight(
  model: PersistedTableModel,
  style: TableStyle,
  axis: TableStyleAxis,
  id: string,
  direction: TextHeightStepDirection,
): PersistedTableModel {
  const range = resolveAxisNumericRange(model, style, axis, id, 'textHeightMm');
  if (!range) return model;

  const next = nextTextHeightFromRange(range, direction);
  if (next === null) return model;

  return setAxisStyleField(model, axis, id, 'textHeightMm', next);
}

/**
 * 🔴 ADR-739 §52 — **η απόφαση του βήματος, χωρίς να ξέρει ΠΟΥ γράφεται.**
 *
 * Εξήχθη από το {@link stepAxisTextHeight} τη στιγμή που η μορφοποίηση απέκτησε **δεύτερο
 * στόχο** (περιοχή κελιών): το «από ποια τιμή ξεκινώ» και το «πότε δεν κάνω τίποτα» είναι
 * ταυτόσημα και στους δύο, ενώ ο γραφέας είναι άλλος. Ένα αντίγραφο των τεσσάρων γραμμών
 * μέσα στο `table-format-scope.ts` δεν θα έφτανε το κατώφλι του jscpd (N.18) — δηλαδή θα
 * ήταν ακριβώς το διπλότυπο **που καμία πύλη δεν βλέπει**, με δύο σημεία που μπορούν κάποτε
 * να μάθουν διαφορετική ασυμμετρία «μεγαλώνω → μέγιστο / μικραίνω → ελάχιστο».
 *
 * `null` σημαίνει «καμία εγγραφή»: είμαστε στο άκρο της σκάλας **και** η σειρά είναι
 * ομοιόμορφη, άρα δεν υπάρχει ούτε βήμα ούτε ισοπέδωση να γίνει. Με **μεικτή** σειρά η
 * εγγραφή γίνεται ακόμη κι όταν η τιμή δεν κουνήθηκε — η ισοπέδωση στο άκρο **είναι** η
 * ζητούμενη αλλαγή (δες την ⚠️ του {@link stepAxisTextHeight}).
 */
export function nextTextHeightFromRange(
  range: TableNumericRange,
  direction: TextHeightStepDirection,
): number | null {
  const from = direction === 1 ? range.max : range.min;
  const next = nextTextHeightStepMm(from, direction);
  if (next === from && range.min === range.max) return null;
  return next;
}

/**
 * `Array.prototype.findLast` χωρίς εξάρτηση από το lib target του έργου.
 *
 * Το `findLast` είναι ES2023· το `tsconfig` του subapp δεν το εγγυάται, και ένα σιωπηλό
 * `undefined is not a function` σε παλιότερη μηχανή θα εμφανιζόταν ως «το A↓ δεν κάνει τίποτα».
 */
function findLast(values: readonly number[], predicate: (value: number) => boolean): number | undefined {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (predicate(values[i])) return values[i];
  }
  return undefined;
}
