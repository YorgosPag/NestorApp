/**
 * 🔴 ADR-739 §56 — **ΤΙ ΣΗΜΑΙΝΕΙ ΤΟ ΠΑΤΗΜΑ** στα έξι κουμπιά στοίχισης. Καθαρό· μηδέν React,
 * μηδέν DOM.
 *
 * ## Γιατί εδώ και όχι μέσα στο component
 * Η γνώση αυτή γεννήθηκε **ιδιωτική** μέσα στο `TableAlignMenu.tsx` (§55), όταν η στοίχιση είχε
 * **μία** επιφάνεια: το mini toolbar. Απέκτησε **δεύτερη** — την κορδέλα — και μια δεύτερη
 * γραφή του ίδιου πλέγματος θα ήταν ακριβώς το σχήμα που τεκμηριώνει ήδη το δίπλα
 * {@link ../table-number-format-ops}: «τρεις ευκαιρίες να μάθει κάθε επιφάνεια **άλλον** κανόνα,
 * με κάθε πλευρά της να δουλεύει».
 *
 * Εδώ το «δουλεύει» θα ήταν ιδιαίτερα πειστικό: μια κορδέλα που γράφει σκέτο `'ML'` για το
 * «στοίχιση αριστερά» **φαίνεται** σωστή σε κάθε κελί που ήταν ήδη στη μέση — και ισοπεδώνει
 * σιωπηλά την κάθετη θέση σε κάθε κελί που δεν ήταν.
 *
 * ## 🔴 Η ΜΙΑ ΤΙΜΗ, ΟΙ ΔΥΟ ΕΡΩΤΗΣΕΙΣ
 * Το {@link TableCellAlign} είναι **ένα** γράμμα κάθετης + **ένα** οριζόντιας θέσης (`'ML'`,
 * `'TR'`, DXF group code 170). Άρα «στοίχισε αριστερά» δεν είναι εγγραφή ενός πεδίου: είναι
 * **αντικατάσταση του μισού** και διατήρηση του άλλου μισού.
 *
 * ⚠️ **Μία αποδεκτή ισοπέδωση, ρητά δηλωμένη**: όταν ο στόχος είναι **ανάμεικτος** δεν υπάρχει
 * «άλλο μισό» να κρατηθεί — η εγγραφή είναι μία τιμή για όλα τα κελιά. Ξεκινά τότε από το
 * {@link MIXED_BASE_TABLE_ALIGN}. Είναι η ίδια φύση με την ισοπέδωση μεγεθών του
 * `stepAxisTextHeight`, όχι ελάττωμα εδώ.
 *
 * @module subapps/dxf-viewer/bim/table/table-align-ops
 * @see types/table.ts — οι 9 θέσεις του `ACAD_TABLE`
 * @see bim/table/table-number-format-ops.ts — το αδελφό module για τη μορφή αριθμού
 */

import type { TableCellAlign } from '../../types/table';

/** Οι τρεις οριζόντιες θέσεις — το **δεύτερο** γράμμα του κωδικού. */
export type TableHorizontalAlign = 'L' | 'C' | 'R';

/** Οι τρεις κάθετες θέσεις — το **πρώτο** γράμμα του κωδικού. */
export type TableVerticalAlign = 'T' | 'M' | 'B';

/**
 * Ποια από τις δύο ερωτήσεις απαντά ένα χειριστήριο.
 *
 * Διακριτή ένωση και όχι δύο ανεξάρτητες παράμετροι: έτσι το «οριζόντιος άξονας με κωδικό `T`»
 * είναι **μη εκφράσιμο**, αντί να είναι μια κλήση που μεταγλωττίζεται και γράφει σκουπίδια.
 */
export type TableAlignChoice =
  | { readonly axis: 'horizontal'; readonly code: TableHorizontalAlign }
  | { readonly axis: 'vertical'; readonly code: TableVerticalAlign };

/**
 * Από πού ξεκινά η σύνθεση όταν δεν υπάρχει «τρέχουσα» τιμή — δες την ⚠️ της κεφαλίδας.
 *
 * Είναι η τιμή που δίνει η κλάση `data` του προεπιλεγμένου στυλ (`table-style-presets.ts`).
 * ⚠️ **Δεν** εισάγεται από εκεί, και δεν είναι παράλειψη: τα presets δίνουν `'ML'` σε άλλες
 * κλάσεις γραμμής και `'TL'` σε άλλες, οπότε «η προεπιλογή του στυλ» δεν είναι **μία** τιμή που
 * θα μπορούσε να διαβαστεί. Αυτή εδώ απαντά σε άλλη ερώτηση: «τι υποθέτω όταν ο χρήστης μου
 * ζητά μισή στοίχιση και τα κελιά δεν συμφωνούν στο άλλο μισό;».
 */
export const MIXED_BASE_TABLE_ALIGN: TableCellAlign = 'ML';

/**
 * Οι εννιά θέσεις ως **πλέγμα**, γραμμένες μία φορά.
 *
 * Η προφανής εναλλακτική — `` `${vertical}${horizontal}` `` — δίνει σωστό αποτέλεσμα αλλά
 * στηρίζεται στο ότι ο μεταγλωττιστής θα συμπεράνει τύπο template literal από τα συμφραζόμενα.
 * Το πλέγμα δεν στηρίζεται σε τίποτα: μια θέση που λείπει είναι **σφάλμα μεταγλώττισης**, και
 * το σχήμα του διαβάζεται όπως ακριβώς το ζωγραφίζει το group code 170.
 */
const ALIGN_GRID: Readonly<
  Record<TableVerticalAlign, Readonly<Record<TableHorizontalAlign, TableCellAlign>>>
> = {
  T: { L: 'TL', C: 'TC', R: 'TR' },
  M: { L: 'ML', C: 'MC', R: 'MR' },
  B: { L: 'BL', C: 'BC', R: 'BR' },
};

/**
 * Η επιλογή εφαρμοσμένη πάνω στην τρέχουσα τιμή: αλλάζει **μόνο** ο άξονάς της.
 *
 * `current === null` (ανάμεικτος στόχος ή στόχος που δεν βρέθηκε) ⇒ βάση το
 * {@link MIXED_BASE_TABLE_ALIGN}. Ο έλεγχος του άξονα δεν είναι αμυντικός — είναι ο τρόπος που ο
 * μεταγλωττιστής στενεύει την ένωση ώστε το `code` να είναι νόμιμο κλειδί σε κάθε κλάδο.
 */
export function nextTableAlign(
  current: TableCellAlign | null,
  choice: TableAlignChoice,
): TableCellAlign {
  const base = current ?? MIXED_BASE_TABLE_ALIGN;
  return choice.axis === 'horizontal'
    ? ALIGN_GRID[tableAlignVertical(base)][choice.code]
    : ALIGN_GRID[choice.code][tableAlignHorizontal(base)];
}

/**
 * Είναι **πατημένο** αυτό το κουμπί;
 *
 * Ανάμεικτος στόχος ⇒ **καμία** επιλογή τσεκαρισμένη: η ερώτηση «είναι αριστερά;» δεν έχει μία
 * απάντηση, και ένα πατημένο κουμπί θα έλεγε ψέματα για τα μισά κελιά. Ίδια σύμβαση με το
 * `isTableNumberFormatActive`.
 */
export function isTableAlignActive(
  current: TableCellAlign | null,
  choice: TableAlignChoice,
): boolean {
  if (current === null) return false;
  return choice.axis === 'horizontal'
    ? tableAlignHorizontal(current) === choice.code
    : tableAlignVertical(current) === choice.code;
}

/** Το κάθετο μισό, χωρίς `charAt` σε θέση όπου ο τύπος πρέπει να επιβιώσει. */
export function tableAlignVertical(align: TableCellAlign): TableVerticalAlign {
  return align === 'TL' || align === 'TC' || align === 'TR'
    ? 'T'
    : align === 'ML' || align === 'MC' || align === 'MR'
      ? 'M'
      : 'B';
}

/** Το οριζόντιο μισό — δες {@link tableAlignVertical}. */
export function tableAlignHorizontal(align: TableCellAlign): TableHorizontalAlign {
  return align === 'TL' || align === 'ML' || align === 'BL'
    ? 'L'
    : align === 'TC' || align === 'MC' || align === 'BC'
      ? 'C'
      : 'R';
}
