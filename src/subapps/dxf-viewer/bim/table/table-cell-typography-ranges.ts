/**
 * 🔴 ADR-753 §28 — **Η ΜΙΑ ΔΙΑΜΕΡΙΣΗ**: κείμενο + runs + στυλ κελιού → μέγιστα **ομοιογενή**
 * εύρη, με την τυπογραφία που ισχύει μέσα στο καθένα.
 *
 * ## Γιατί βγήκε από τον ζωγράφο
 * Μέχρι το §28 ζούσε ιδιωτικά μέσα στο {@link import('./table-cell-styled-spans')}, και ήταν
 * σωστό όσο ο καταναλωτής ήταν **ένας**: ο ζωγράφος του καμβά, που αμέσως μετά τη διαμέριση
 * **μετρά** κάθε τμήμα σε sheet-mm και το τοποθετεί.
 *
 * Το §28 έφερε **δεύτερο** καταναλωτή με εντελώς άλλες ανάγκες: ο in-place επεξεργαστής
 * κελιού ζωγραφίζει τα ίδια ακριβώς τμήματα ως `span` του DOM, όπου τη μέτρηση και την
 * τοποθέτηση τις κάνει **ο browser**. Εκείνος δεν θέλει ούτε `measure`, ούτε `offsetMm`,
 * ούτε `advanceMm` — θέλει **μόνο** την απάντηση στο «ποια γράμματα, με ποια τυπογραφία».
 *
 * Η εξαγωγή είναι επομένως **σημασιολογική**, όχι αριθμητική: η διαμέριση («ποια γράμματα
 * ανήκουν μαζί») είναι άλλη ερώτηση από τη μέτρηση («πόσο πλατύ είναι το καθένα»), και μόνο
 * η πρώτη είναι κοινή. Ένα δεύτερο σώμα θα ήταν sibling clone (N.18 / CHECK 3.28) — και,
 * ουσιωδέστερα, δύο σημεία που μπορούν να απαντήσουν **διαφορετικά** στο ίδιο κελί: τότε ο
 * καμβάς θα ζωγράφιζε άλλα όρια από τον επεξεργαστή, και ο χρήστης θα έβλεπε τη μορφοποίησή
 * του να **μετακινείται** τη στιγμή του `Enter`.
 *
 * ⚠️ **Καμία αλλαγή συμπεριφοράς σε αυτή τη μετακόμιση.** Τα τρία σώματα
 * ({@link cellTypographyRanges}, `styledRanges`, `mergeEqualNeighbours`) ήρθαν αυτούσια· ο
 * ζωγράφος τα καταναλώνει από εδώ και τα χαρακτηρισμένα στιγμιότυπά του μένουν
 * byte-ταυτόσημα.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-typography-ranges
 * @see bim/table/table-cell-styled-spans.ts — ο πρώτος καταναλωτής (καμβάς, sheet-mm)
 * @see ui/table-cell-editor/table-cell-editor-spans.ts — ο δεύτερος (DOM, CSS)
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md §28
 */

import type { TableCellTextRun, TableTextRunStyle } from '../../types/table';
import type { TableTextStyleSpan } from './table-layout-types';
import { clearable, inherited, type TableCellStyle } from './table-style';

/** Η τυπογραφία ενός τμήματος — το {@link TableTextStyleSpan} χωρίς τη γεωμετρία του. */
export type TableSpanTypography = Omit<
  TableTextStyleSpan,
  'text' | 'start' | 'end' | 'offsetMm' | 'advanceMm'
>;

/** Ένα εύρος χαρακτήρων με **επιλυμένη** τυπογραφία — πριν από κάθε μέτρηση. */
export interface TableTypographyRange {
  readonly start: number;
  readonly end: number;
  readonly typography: TableSpanTypography;
}

export interface CellTypographyRangesInput {
  /** Το μήκος του **ορατού** κειμένου — ποτέ του `TableCell.value` (δες τον καλούντα). */
  readonly textLength: number;
  /** Τα κανονικοποιημένα runs του μοντέλου (ADR-753 Φ1). Απόντα ⇒ ένα εύρος. */
  readonly runs?: readonly TableCellTextRun[];
  /**
   * Πόσοι από τους πρώτους χαρακτήρες είναι **περιεχόμενο του χρήστη**· απόν ⇒ όλοι. Ό,τι
   * είναι πέρα από αυτό είναι **σημάδι του πίνακα** (αποσιωπητικά, `####`) και παίρνει το
   * στυλ του κελιού — δες την κεφαλίδα του `table-cell-styled-spans.ts`.
   */
  readonly runsLimit?: number;
  /** Το **επιλυμένο** στυλ του κελιού — η βάση κάθε κληρονομιάς. */
  readonly style: TableCellStyle;
}

/**
 * Το κείμενο σπασμένο σε **μέγιστα ομοιογενή** εύρη.
 *
 * Κενός πίνακας για κενό κείμενο· **ακριβώς ένα** εύρος όταν δεν υπάρχει καμία μορφοποίηση
 * ανά χαρακτήρα — η αναλλοίωτη πάνω στην οποία στηρίζεται ολόκληρο το ADR-751.
 */
export function cellTypographyRanges(
  input: CellTypographyRangesInput,
): readonly TableTypographyRange[] {
  const { textLength, style } = input;
  if (textLength <= 0) return [];
  const limit = Math.min(input.runsLimit ?? textLength, textLength);
  return mergeEqualNeighbours(styledRanges(textLength, input.runs, limit), style);
}

/**
 * Στυλ κελιού + η δήλωση του τμήματος → η τυπογραφία που ισχύει.
 *
 * Οι δύο βοηθοί έρχονται από το `table-style.ts` και **δεν** ξαναγράφονται: η δοκτρίνα
 * «`undefined` ⇒ κληρονόμησε · `null` ⇒ ρητά η προεπιλογή» έχει ένα σώμα για όλα τα επίπεδα
 * (§3.2 του ADR-753). Από τα έξι πεδία μόνο το `fontFamily` είναι καθαρίσιμο — ακριβώς εκείνα
 * που το `TableCellStyle` δηλώνει προαιρετικά.
 */
export function spanTypographyOf(
  base: TableCellStyle,
  style: TableTextRunStyle | undefined,
): TableSpanTypography {
  const fontFamily = clearable([style?.fontFamily], base.fontFamily);
  return {
    heightMm: inherited([style?.textHeightMm], base.textHeightMm),
    colorHex: inherited([style?.textColorHex], base.textColorHex),
    bold: inherited([style?.bold], base.bold),
    italic: inherited([style?.italic], base.italic),
    underline: inherited([style?.underline], base.underline),
    ...(fontFamily !== undefined && { fontFamily }),
  };
}

/**
 * Ισότητα τυπογραφίας — **πεδίο προς πεδίο, ρητά**.
 *
 * ⚠️ **Δηλωμένο ρητά: κανένα test δεν διακρίνει αυτή την εκδοχή από ένα `JSON.stringify`.**
 * Και δεν μπορεί να το διακρίνει, γιατί κάθε τυπογραφία γεννιέται από **έναν** τόπο
 * ({@link spanTypographyOf}), άρα πάντα με την ίδια σειρά κλειδιών — ακριβώς η συνθήκη υπό
 * την οποία τα δύο είναι ισοδύναμα.
 *
 * Γράφεται έτσι επειδή αυτή η ισοδυναμία είναι **σύμπτωση ενός κατασκευαστή**, όχι ιδιότητα
 * του ερωτήματος: την ημέρα που μια δεύτερη διαδρομή φτιάξει τυπογραφία (μια εισαγωγή
 * `.xlsx`, ένα υπόλειμμα από `JSON.parse`), το `stringify` θα άρχιζε να λέει «διαφορετικά»
 * για ίσα στυλ — και το σύμπτωμα θα ήταν τμήματα που δεν συγχωνεύονται ποτέ, δηλαδή χαμένο
 * kerning χωρίς κανένα κόκκινο test.
 *
 * Το ADR-753 §8 κατέγραψε ότι **ένα σχόλιο δεν είναι φύλακας**. Η συνέπεια δεν είναι να
 * επινοηθεί test που δεν μπορεί να υπάρξει — είναι να **μη διεκδικηθεί** φύλακας που λείπει.
 */
export function sameSpanTypography(a: TableSpanTypography, b: TableSpanTypography): boolean {
  return (
    a.heightMm === b.heightMm &&
    a.colorHex === b.colorHex &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.fontFamily === b.fontFamily
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Εσωτερικά
// ──────────────────────────────────────────────────────────────────────────────

/** Ένα εύρος με το **ωμό** run που το γέννησε (απόν στα κενά ανάμεσα στα runs). */
interface StyledRange {
  readonly start: number;
  readonly end: number;
  readonly style?: TableTextRunStyle;
}

/**
 * Τα runs σε **πλήρη κάλυψη** του κειμένου: τα κενά ανάμεσά τους γίνονται ρητά εύρη χωρίς
 * στυλ, ώστε ο επόμενος βρόχος να μη χρειάζεται να ρωτήσει ποτέ «υπάρχει τμήμα εδώ;».
 *
 * Τα runs είναι ήδη κανονικοποιημένα (ταξινομημένα, χωρίς επικαλύψεις) από το
 * `table-cell-run-ops.ts` — ο περιορισμός στο `limit` και ο `cursor` δεν το ξαναελέγχουν,
 * κόβουν μόνο ό,τι πέφτει έξω από το **ορατό** κείμενο μετά την περικοπή.
 */
function styledRanges(
  textLength: number,
  runs: readonly TableCellTextRun[] | undefined,
  limit: number,
): readonly StyledRange[] {
  const out: StyledRange[] = [];
  let cursor = 0;
  for (const run of runs ?? []) {
    const start = Math.max(run.start, cursor);
    const end = Math.min(run.end, limit);
    if (end <= start) continue;
    if (start > cursor) out.push({ start: cursor, end: start });
    out.push({ start, end, style: run.style });
    cursor = end;
  }
  if (cursor < textLength) out.push({ start: cursor, end: textLength });
  return out;
}

/**
 * Γειτονικά εύρη με **ίδια επιλυμένη** τυπογραφία γίνονται ένα.
 *
 * 🔴 Η σύγκριση γίνεται στο **επιλυμένο** στυλ, όχι στο run: ένα run που δηλώνει
 * `bold: false` πάνω σε κελί που ήδη δεν είναι έντονο **δεν είναι** τμήμα — δεν αλλάζει
 * κανένα glyph. Αν επιβίωνε ως χωριστό τμήμα, θα κόστιζε ένα ζεύγος kerning και μια κλήση
 * σχεδίασης για μηδέν οπτική διαφορά, μόνιμα.
 */
function mergeEqualNeighbours(
  ranges: readonly StyledRange[],
  style: TableCellStyle,
): readonly TableTypographyRange[] {
  const out: { start: number; end: number; typography: TableSpanTypography }[] = [];
  for (const range of ranges) {
    const typography = spanTypographyOf(style, range.style);
    const last = out[out.length - 1];
    if (last !== undefined && sameSpanTypography(last.typography, typography)) last.end = range.end;
    else out.push({ start: range.start, end: range.end, typography });
  }
  return out;
}
