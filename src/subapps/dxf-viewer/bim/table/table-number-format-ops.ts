/**
 * 🔴 ADR-760 / ADR-739 §55 — **ΤΙ ΣΗΜΑΙΝΕΙ ΤΟ ΠΑΤΗΜΑ** στα πέντε κουμπιά αριθμού του mini
 * toolbar (λογιστική · % · χιλιάδες · δεκαδικά ±). Καθαρό· μηδέν React, μηδέν DOM.
 *
 * ## Γιατί εδώ και όχι μέσα στο component
 * Το ADR-760 έγραψε τον **τύπο** ({@link TableCellFormat}) και τη **μηχανή απόδοσης**
 * (`table-cell-format.ts`), αλλά κανέναν **γραφέα**: μέχρι σήμερα το `numberFormat` δεν το
 * έγραφε τίποτα. Η πρώτη επιφάνεια που το γράφει είναι αυτή, και θα ακολουθήσουν δεύτερη
 * (κορδέλα) και τρίτη (διάλογος «Μορφοποίηση κελιών»). Γραμμένη μέσα στο JSX, η απόφαση «τι
 * κάνει το %» θα ήταν το ίδιο σχήμα με τους έξι χειριστές που το §52 βρήκε αντιγραμμένους στο
 * `use-table-header-menu.ts` — τρεις ευκαιρίες να μάθει κάθε επιφάνεια **άλλον** κανόνα, με
 * κάθε πλευρά της να δουλεύει.
 *
 * ## 🔴 Η ΤΙΜΗ ΔΕΝ ΑΓΓΙΖΕΤΑΙ ΠΟΤΕ
 * Καμία συνάρτηση εδώ δεν επιστρέφει αριθμό — μόνο **μορφές**. Είναι ο κανόνας «τιμή ≠
 * εμφάνιση» του `types/table-cell-format.ts`, ο οποίος εδώ δεν είναι σχόλιο αλλά **υπογραφή**:
 * με έξοδο `TableCellFormat` δεν υπάρχει διαδρομή από αυτό το module προς το `TableCell.value`.
 *
 * ## Πώς διαβάζονται οι επιστροφές
 * ```
 *   TableCellFormat  →  γράψε αυτό  (setField(target, 'numberFormat', value))
 *   undefined        →  ΣΒΗΣΕ το πεδίο ⇒ κληρονομιά (το «ξεπάτημα» του κουμπιού)
 *   null             →  ΚΑΜΙΑ εγγραφή (είμαστε στο άκρο· ίδια σύμβαση με το
 *                       nextTextHeightFromRange του `table-text-height-scale.ts`)
 * ```
 *
 * @module subapps/dxf-viewer/bim/table/table-number-format-ops
 * @see bim/table/table-number-format-facets.ts — οι **όψεις** (η τρίτη επιφάνεια γράφει τιμές)
 * @see types/table-cell-format.ts — ο τύπος και ο κανόνας «τιμή ≠ εμφάνιση»
 * @see bim/table/table-cell-format.ts — η **ανάγνωση** (ποια μορφή ισχύει, πώς αποδίδεται)
 * @see ui/components/table-format-toolbar/TableNumberFormatSection.tsx — τα πέντε κουμπιά
 */

import type { Precision } from '../../config/number-format-config';
import {
  DEFAULT_TABLE_CURRENCY,
  DEFAULT_TABLE_DATE_STYLE,
  type TableCellFormat,
} from '../../types/table-cell-format';
// 🔴 ADR-739 §60 — οι **όψεις** εξήχθησαν όταν ο διάλογος έγινε τρίτος καταναλωτής τους: εκείνος
// γράφει τιμή, εδώ γράφεται πάτημα, αλλά το «τι σημαίνει ομαδοποίηση» πρέπει να είναι ΕΝΑ.
import {
  DEFAULT_TABLE_ANGLE_UNIT,
  clampTableFormatDecimals,
  tableNumberFormatDecimals,
  tableNumberFormatHasGrouping,
  tableNumberFormatLocalePart,
  tableNumberFormatSupportsGrouping,
  withTableNumberFormatDecimals,
  withTableNumberFormatGrouping,
} from './table-number-format-facets';

/**
 * Οι τρεις εντολές «τι **είδους** αριθμός είναι αυτός» — η σειρά 1 του Excel mini toolbar.
 *
 * Τα δεκαδικά **δεν** είναι εντολή αυτού του τύπου και γι' αυτό λείπουν από την ένωση: δεν
 * αλλάζουν το είδος, μετακινούν την **ακρίβεια** μέσα σε ό,τι ισχύει ήδη. Χωμένα εδώ, θα
 * ήταν δύο ερωτήσεις με ένα λεξιλόγιο.
 */
export type TableNumberFormatCommandId = 'accounting' | 'percent' | 'grouping';

/** `+1` δείχνει περισσότερα δεκαδικά. */
export type TableDecimalStepDirection = 1 | -1;

/** Λογιστική μορφή: δύο δεκαδικά — η σύμβαση κάθε προϋπολογισμού και του Excel. */
const ACCOUNTING_DECIMALS: Precision = 2;
/** Το «%» του Excel δίνει **ακέραιο** ποσοστό· τα δεκαδικά τα ζητά ο χρήστης με το `.00→`. */
const PERCENT_DECIMALS: Precision = 0;
/** Το «Comma style» του Excel: `#,##0.00`. */
const COMMA_STYLE_DECIMALS: Precision = 2;

/**
 * Είναι **πατημένο** αυτό το κουμπί;
 *
 * `null` (ανάμεικτος στόχος) ⇒ κανένα κουμπί δεν είναι πατημένο: η ερώτηση «είναι ποσοστό;»
 * δεν έχει **μία** απάντηση, και ένα πατημένο κουμπί θα έλεγε ψέματα για τα μισά κελιά.
 */
export function isTableNumberFormatActive(
  current: TableCellFormat | null,
  command: TableNumberFormatCommandId,
): boolean {
  if (current === null) return false;
  switch (command) {
    case 'accounting':
      return current.kind === 'currency';
    case 'percent':
      return current.kind === 'percent';
    case 'grouping':
      return tableNumberFormatHasGrouping(current);
  }
}

/**
 * 🔴 ADR-739 §55 — **δύο μορφές, η ίδια απάντηση;**
 *
 * ## Γιατί ΟΧΙ `===`
 * Το `resolveCellNumberFormat` επιστρέφει τη σημασιολογική βάση της στήλης **by-reference**
 * (σταθερά του module ⇒ ίδιο αντικείμενο για κάθε κελί), αλλά τις **ρητές** παρακάμψεις όπως
 * γράφτηκαν — δηλαδή δέκα κελιά ρητά «%» κρατούν δέκα διαφορετικά αντικείμενα. Με ταυτότητα
 * αναφοράς, μια ολόκληρη στήλη ρητά ποσοστιαία θα διαβαζόταν **ανάμεικτη** και το κουμπί «%»
 * θα έσβηνε — ψέμα ακριβώς εκεί που ο χρήστης βλέπει ποσοστά.
 *
 * ## Γιατί ΟΧΙ `JSON.stringify`
 * Η σειρά κλειδιών δεν είναι συμβόλαιο: `{kind,decimals}` και `{decimals,kind}` είναι η **ίδια**
 * μορφή και θα έβγαιναν διαφορετικά αλφαριθμητικά.
 *
 * ⚠️ Οι προαιρετικές τιμές **κανονικοποιούνται** πριν συγκριθούν: «απόν» και «η προεπιλογή»
 * είναι η ίδια μορφή για τον χρήστη, και ένα `undefined !== 'EUR'` θα δήλωνε μεικτό στόχο εκεί
 * που όλα τα κελιά δείχνουν ευρώ. Το `grouping` περνά από το
 * {@link tableNumberFormatHasGrouping} — τον ίδιο κριτή που ανάβει το κουμπί των χιλιάδων **και**
 * το κουτάκι του διαλόγου, ώστε «ίδια μορφή» και «ίδιο πατημένο» να μην μπορούν να διαφωνήσουν.
 */
export function isTableCellFormatEqual(a: TableCellFormat, b: TableCellFormat): boolean {
  if (a.kind !== b.kind || a.locale !== b.locale) return false;
  if (tableNumberFormatDecimals(a) !== tableNumberFormatDecimals(b)) return false;
  if (tableNumberFormatHasGrouping(a) !== tableNumberFormatHasGrouping(b)) return false;

  if (a.kind === 'currency' && b.kind === 'currency') {
    return (a.currency ?? DEFAULT_TABLE_CURRENCY) === (b.currency ?? DEFAULT_TABLE_CURRENCY);
  }
  if (a.kind === 'date' && b.kind === 'date') {
    return (a.style ?? DEFAULT_TABLE_DATE_STYLE) === (b.style ?? DEFAULT_TABLE_DATE_STYLE);
  }
  if (a.kind === 'angle' && b.kind === 'angle') {
    return (a.unit ?? DEFAULT_TABLE_ANGLE_UNIT) === (b.unit ?? DEFAULT_TABLE_ANGLE_UNIT);
  }
  return true;
}

/**
 * Η **επόμενη** μορφή μετά από πάτημα — ή `undefined` για «σβήσε το πεδίο».
 *
 * Πατημένο ⇒ το πάτημα **ξεπατά**: λογιστική/ποσοστό σβήνουν την παράκαμψη (ο στόχος γυρίζει
 * στην κληρονομιά, δηλαδή στη σημασιολογική βάση της στήλης), οι χιλιάδες γράφουν ρητό `false`
 * — γιατί εκεί η κληρονομιά **λέει ναι** και ένα σβήσιμο δεν θα άλλαζε τίποτα ορατό.
 *
 * ⚠️ Το `locale` της τρέχουσας μορφής **επιβιώνει**: είναι η σύμβαση αριθμών του **σχεδίου**
 * (`types/table-cell-format.ts`), όχι μέρος του «τι είδους αριθμός». Χαμένο σε κάθε πάτημα «%»,
 * ο πίνακας θα άλλαζε σιωπηλά υποδιαστολή.
 */
export function nextTableNumberFormat(
  current: TableCellFormat | null,
  command: TableNumberFormatCommandId,
): TableCellFormat | undefined {
  const locale = tableNumberFormatLocalePart(current);

  if (current !== null && isTableNumberFormatActive(current, command)) {
    return command === 'grouping' ? withTableNumberFormatGrouping(current, false) : undefined;
  }

  switch (command) {
    case 'accounting':
      return { kind: 'currency', decimals: ACCOUNTING_DECIMALS, ...locale };
    case 'percent':
      return { kind: 'percent', decimals: PERCENT_DECIMALS, ...locale };
    case 'grouping':
      return current !== null && tableNumberFormatSupportsGrouping(current)
        ? withTableNumberFormatGrouping(current, true)
        : { kind: 'decimal', decimals: COMMA_STYLE_DECIMALS, grouping: true, ...locale };
  }
}

/**
 * Ένα σκαλί δεκαδικών πάνω/κάτω — `null` ⇒ **καμία εγγραφή**.
 *
 * ## Από πού ξεκινά όταν η μορφή δεν έχει δεκαδικά
 * Το `general`/`text`/`date` δεν έχουν ακρίβεια, άρα δεν υπάρχει τιμή να αυξηθεί. Ο Excel
 * απαντά «σαν να ήταν 0» — το `3` γίνεται `3,0` με ένα πάτημα — και το ίδιο κάνουμε: βάση `0`
 * και **έξοδος `decimal`**. Το ίδιο ισχύει για ανάμεικτο στόχο (`null`): ο χρήστης βλέπει
 * ένα κουμπί «περισσότερα δεκαδικά» και παίρνει περισσότερα δεκαδικά, παντού.
 *
 * ⚠️ Το άκρο επιστρέφει `null` **μόνο** όταν η τρέχουσα μορφή έχει όντως ακρίβεια: αλλιώς η
 * αλλαγή είδους (`general` → `decimal 0`) είναι η ζητούμενη πράξη, ακόμη κι αν ο αριθμός δεν
 * κουνηθεί. Ίδια διάκριση με το `nextTextHeightFromRange` σε μεικτή σειρά.
 */
export function stepTableNumberFormatDecimals(
  current: TableCellFormat | null,
  direction: TableDecimalStepDirection,
): TableCellFormat | null {
  const from = tableNumberFormatDecimals(current);
  const next = clampTableFormatDecimals((from ?? 0) + direction);
  if (from !== null && next === from) return null;
  return withTableNumberFormatDecimals(current, next);
}
