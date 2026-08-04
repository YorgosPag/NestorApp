/**
 * 🔴 ADR-754 **Γ4** — **Η ΛΑΒΗ ΣΥΜΠΛΗΡΩΣΗΣ**: πού κάθεται, πότε πιάνεται, και **ποια περιοχή**
 * υπόσχεται η σύρση. Καθαρή γεωμετρία — μηδέν DOM, μηδέν store, μηδέν React.
 *
 * Το μικρό τετράγωνο στην **κάτω δεξιά γωνία** της επιλογής. Το πιάνεις, το σέρνεις, και ό,τι
 * υπάρχει στην επιλογή αντιγράφεται στα κελιά που διέσχισες — με τους τύπους να **ολισθαίνουν**
 * (`table-formula-offset.ts`) και τα `$` να μένουν.
 *
 * ## 🔴 ΕΝΑΣ ΑΞΟΝΑΣ, ΠΟΤΕ ΔΥΟ — και δεν είναι απλοποίηση
 * Στο Excel η σύρση της λαβής κλειδώνει σε **έναν** άξονα: τραβάς κάτω ⇒ γεμίζουν γραμμές,
 * τραβάς δεξιά ⇒ γεμίζουν στήλες. Διαγώνια σύρση **δεν** γεμίζει ορθογώνιο· διαλέγει τον άξονα
 * με τη μεγαλύτερη μετατόπιση.
 *
 * Ο λόγος είναι σημασιολογικός, όχι τεχνικός: η συμπλήρωση απαντά «**επανάλαβε αυτό το μοτίβο
 * προς τα εκεί**», και ένα μοτίβο έχει **κατεύθυνση**. Ένα διαγώνιο γέμισμα θα έπρεπε να
 * αποφασίσει αν το `=B2*C2` της γωνίας ολισθαίνει κατά γραμμή, κατά στήλη ή και τα δύο — τρεις
 * διαφορετικοί αριθμοί, καμία ένδειξη ποιον ήθελε ο χρήστης. Η επιλογή άξονα **είναι** η
 * απάντηση, και τη δίνει το χέρι του.
 *
 * ## Γιατί το μέγεθος είναι σε **px οθόνης**
 * Είναι στοιχείο **διεπαφής**, όχι γεωμετρία σχεδίου — ίδιο επιχείρημα με τις λαβές, τις ζώνες
 * του δείκτη και το ⊕ της εισαγωγής (ADR-739 §40): σε sheet-mm θα γινόταν αόρατο σε zoom-out
 * και τεράστιο σε zoom-in.
 *
 * @module subapps/dxf-viewer/bim/table/table-fill-handle
 * @see bim/table/table-fill-apply.ts — τι ΓΙΝΕΤΑΙ το μοντέλο όταν αφεθεί η λαβή
 * @see bim/table/table-cell-range.ts — ο ΕΝΑΣ ορισμός του «ορθογώνιο κελιών»
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §13
 */

import type { TableCellRangeBounds } from './table-cell-range';
import { tableRangeRectMm } from './table-cell-range';
import type { TableLayout, TableRectMm } from './table-layout-types';

/**
 * Η **πλευρά** του τετραγώνου σε px οθόνης.
 *
 * Έξι px δίνουν στόχο 6×6 — ακριβώς όσο του Excel, και μικρότερο από κάθε λαβή του σχεδίου
 * επίτηδες: η λαβή συμπλήρωσης κάθεται **μέσα** στον πίνακα, όπου ο χρήστης δουλεύει, και ένα
 * μεγαλύτερο τετράγωνο θα σκέπαζε κείμενο κελιού.
 */
export const TABLE_FILL_HANDLE_PX = 6;

/**
 * Πόσο πιο γενναιόδωρη είναι η **σύλληψη** από τη ζωγραφιά.
 *
 * Ο λόγος είναι το WCAG 2.2 SC 2.5.8: ένας στόχος 6 px είναι κάτω από κάθε κατώφλι. Η λύση
 * **δεν** είναι να μεγαλώσει το τετράγωνο (θα έκρυβε κείμενο) αλλά να μεγαλώσει η **οπή** —
 * ίδια διάκριση «φαίνεται μικρό, πιάνεται εύκολα» που κάνουν ήδη οι λαβές του σχεδίου με το
 * `gripAperturePx`, και το ⊕ της εισαγωγής με τις δύο φάσεις του.
 */
export const TABLE_FILL_HANDLE_APERTURE_PX = 4;

/** Ποιον άξονα διάλεξε το χέρι, και προς τα πού. */
export type TableFillDirection = 'down' | 'up' | 'right' | 'left';

/** Τι υπόσχεται η σύρση: ποια κελιά θα γεμίσουν, και από ποια κατεύθυνση. */
export interface TableFillTarget {
  /** **Μόνο τα νέα** κελιά — η πηγή δεν περιλαμβάνεται ποτέ. */
  readonly bounds: TableCellRangeBounds;
  readonly direction: TableFillDirection;
}

/**
 * Το τετράγωνο της λαβής σε **sheet-mm του πλαισίου**, ή `null` όταν η περιοχή δεν τέμνει τη
 * διάταξη.
 *
 * Κάθεται **κεντραρισμένο** στην κάτω-δεξιά κορυφή της περιοχής, δηλαδή μισό μέσα και μισό
 * έξω. Είναι η θέση του Excel και είναι και η μόνη που δεν λέει ψέματα: η λαβή ανήκει
 * ταυτόχρονα στο τελευταίο κελί (από εκεί ξεκινά το μοτίβο) και στο κενό δίπλα του (προς τα
 * εκεί πάει).
 */
export function tableFillHandleRectMm(
  layout: TableLayout,
  bounds: TableCellRangeBounds,
  pxPerMm: number,
): TableRectMm | null {
  const rect = tableRangeRectMm(layout, bounds);
  if (!rect || pxPerMm <= 0) return null;
  const sideMm = TABLE_FILL_HANDLE_PX / pxPerMm;
  return {
    x: rect.x + rect.w - sideMm / 2,
    y: rect.y + rect.h - sideMm / 2,
    w: sideMm,
    h: sideMm,
  };
}

/**
 * Είναι το σημείο (σε sheet-mm του πλαισίου) πάνω στη λαβή;
 *
 * Η **οπή** μεγαλώνει το ορθογώνιο ομοιόμορφα — δες {@link TABLE_FILL_HANDLE_APERTURE_PX} για
 * το γιατί δεν μεγαλώνει αντ' αυτού η ζωγραφιά.
 */
export function isOnTableFillHandle(
  point: { readonly u: number; readonly v: number },
  rect: TableRectMm,
  pxPerMm: number,
): boolean {
  if (pxPerMm <= 0) return false;
  const padMm = TABLE_FILL_HANDLE_APERTURE_PX / pxPerMm;
  return (
    point.u >= rect.x - padMm &&
    point.u <= rect.x + rect.w + padMm &&
    point.v >= rect.y - padMm &&
    point.v <= rect.y + rect.h + padMm
  );
}

/**
 * 🔑 **Ποια κελιά υπόσχεται η σύρση**, δεδομένου του κελιού κάτω από το χέρι.
 *
 * `null` όταν το χέρι είναι ακόμη **μέσα** στην πηγή: εκεί δεν υπάρχει τίποτα να γεμίσει, και
 * η σιωπή είναι η σωστή απάντηση — όχι «γέμισε την ίδια σου την επιλογή».
 *
 * ## Ο άξονας διαλέγεται από τη **μεγαλύτερη** υπέρβαση
 * Το χέρι σπάνια κινείται σε τέλεια ευθεία. Μετριέται πόσο βγήκε έξω από την πηγή σε κάθε
 * άξονα και κερδίζει ο μεγαλύτερος· στην **ισοπαλία** κερδίζει ο κατακόρυφος, γιατί η
 * συμπλήρωση προς τα κάτω είναι ασύγκριτα συχνότερη σε πίνακα ποσοτήτων (μια στήλη τιμών ανά
 * γραμμή εργασίας) και μια διαγώνια κίνηση 1×1 πιο πιθανά εννοεί «κάτω».
 */
export function resolveTableFillTarget(
  source: TableCellRangeBounds,
  at: { readonly row: number; readonly col: number },
): TableFillTarget | null {
  const rowOver = overshoot(at.row, source.firstRow, source.lastRow);
  const colOver = overshoot(at.col, source.firstCol, source.lastCol);
  if (rowOver === 0 && colOver === 0) return null;

  if (Math.abs(rowOver) >= Math.abs(colOver)) {
    return rowOver > 0
      ? { direction: 'down', bounds: { ...source, firstRow: source.lastRow + 1, lastRow: at.row } }
      : { direction: 'up', bounds: { ...source, firstRow: at.row, lastRow: source.firstRow - 1 } };
  }
  return colOver > 0
    ? { direction: 'right', bounds: { ...source, firstCol: source.lastCol + 1, lastCol: at.col } }
    : { direction: 'left', bounds: { ...source, firstCol: at.col, lastCol: source.lastCol - 1 } };
}

/** Πόσο βγήκε ο δείκτης έξω από το κλειστό διάστημα — `0` όσο είναι μέσα. */
function overshoot(value: number, first: number, last: number): number {
  if (value > last) return value - last;
  if (value < first) return value - first;
  return 0;
}

/**
 * Η **ένωση** πηγής και στόχου — το ορθογώνιο που δείχνει η προεπισκόπηση όσο σέρνεις.
 *
 * Υπάρχει ως συνάρτηση αντί για δύο `Math.min/max` στον καλούντα γιατί το ρωτούν **δύο**: ο
 * ζωγράφος της προεπισκόπησης και η επιλογή που μένει πίσω μετά το γέμισμα (Excel: μετά τη
 * συμπλήρωση είναι μαρκαρισμένη **ολόκληρη** η περιοχή, πηγή και γέμισμα μαζί).
 */
export function tableFillPreviewBounds(
  source: TableCellRangeBounds,
  target: TableFillTarget,
): TableCellRangeBounds {
  return {
    firstRow: Math.min(source.firstRow, target.bounds.firstRow),
    lastRow: Math.max(source.lastRow, target.bounds.lastRow),
    firstCol: Math.min(source.firstCol, target.bounds.firstCol),
    lastCol: Math.max(source.lastCol, target.bounds.lastCol),
  };
}
