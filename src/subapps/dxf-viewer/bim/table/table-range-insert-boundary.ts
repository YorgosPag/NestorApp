/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 3) — **ΣΕ ΠΟΙΟ ΣΥΝΟΡΟ ΚΡΕΜΕΤΑΙ ΤΟ ΠΟΝΤΙΚΙ**, και πώς φαίνεται αυτό.
 * Καθαρή γεωμετρία — μηδέν DOM, μηδέν store, μηδέν React.
 *
 * ## Η ερώτηση που δεν είχε απάντηση
 * Το `planTableRangeTransfer` απαιτεί `shiftAxis: 'down' | 'right'` και η Φάση 2 το δεχόταν ως
 * **δεδομένο**. Κανείς δεν το παρήγε: η πρόθεση (`Ctrl`/`Shift`) γεννιέται από τα **πλήκτρα**,
 * η κατεύθυνση όμως γεννιέται από τη **γεωμετρία** — ακριβώς όπως το λέει ήδη η κεφαλίδα του
 * `table-range-axis-view`. Αυτό εδώ είναι η γεωμετρία που έλειπε.
 *
 * Ο κανόνας είναι του Excel και είναι **μετρήσιμος**, όχι θέμα γούστου: κρατώντας `Shift`, η
 * παχιά γκρι **γραμμή-Ι** εμφανίζεται στο σύνορο που είναι **πιο κοντά** στον δείκτη. Οριζόντιο
 * σύνορο (ανάμεσα σε δύο γραμμές) ⇒ τα υπάρχοντα σπρώχνονται **κάτω**· κατακόρυφο (ανάμεσα σε
 * δύο στήλες) ⇒ **δεξιά**. Μία σύγκριση δύο αποστάσεων, καμία κατάσταση, κανένα κατώφλι.
 *
 * ## 🔴 ΓΙΑΤΙ Η ΓΡΑΜΜΗ-Ι ΒΓΑΙΝΕΙ ΑΠΟ ΤΟ **ΣΧΕΔΙΟ** ΚΑΙ ΟΧΙ ΑΠΟ ΤΟ ΣΥΝΟΡΟ ΠΟΥ ΔΕΙΧΝΕΙ ΤΟ ΧΕΡΙ
 * Το {@link tableRangeInsertCaretMm} δέχεται το **ορθογώνιο προσγείωσης** — δηλαδή το
 * `plan.destination` — και **όχι** το `line` της {@link TableRangeInsertBoundary}. Δεν είναι
 * λεπτομέρεια: όταν η ολίσθηση **κλείνει την τρύπα** της πηγής (§36.5), η περιοχή προσγειώνεται
 * **ψηλότερα** από το σύνορο που δείχνει το χέρι. Το Excel ζωγραφίζει τη γραμμή-Ι στο σύνορο
 * του χεριού και παραδίδει αλλού — η διαφορά είναι ακριβώς όσο η πηγή.
 *
 * Εμείς **δεν** το αντιγράφουμε: ό,τι ζωγραφίζεται βγαίνει από το σχέδιο, οπότε φάντασμα και
 * γραμμή-Ι **δεν μπορούν** να διαφωνήσουν ούτε μεταξύ τους ούτε με το αποτέλεσμα. Το σύνορο του
 * χεριού κάνει τη μία δουλειά που του ανήκει — **διαλέγει άξονα και θέση** — και μετά σιωπά.
 *
 * @module subapps/dxf-viewer/bim/table/table-range-insert-boundary
 * @see bim/table/table-range-axis-view.ts — τι σημαίνει `'down'` / `'right'`
 * @see bim/table/table-range-shift-plan.ts — ποιος καταναλώνει την κατεύθυνση
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import type { TableFramePoint } from '../../types/table-entity';
import type { TableLayout, TableRectMm } from './table-layout-types';
import type { TableRangeShiftAxis } from './table-range-axis-view';

/**
 * Το σύνορο εισαγωγής κάτω από τον δείκτη: **ποιος άξονας** ολισθαίνει και **ποια θέση**
 * δέχεται την πρώτη γραμμή/στήλη της περιοχής.
 *
 * Το `line` είναι δείκτης **συνόρου**, όχι κελιού: για `n` γραμμές υπάρχουν `n + 1` σύνορα, και
 * το `line === n` σημαίνει «μετά την τελευταία». Δεν φιλτράρεται εδώ — ο πίνακας **δεν
 * μεγαλώνει μόνος του** (§36) και η άρνηση ανήκει στο σχέδιο, που ξέρει και το **μέγεθος** της
 * περιοχής. Ένα φράγμα εδώ θα έλεγε «όχι» σε θέσεις που η μετάθεση δέχεται μια χαρά.
 */
export interface TableRangeInsertBoundary {
  readonly axis: TableRangeShiftAxis;
  readonly line: number;
}

/**
 * 🔴 §36 ΦΑΣΗ 3 — **ΠΟΙΟ ΣΥΝΟΡΟ ΕΙΝΑΙ ΠΙΟ ΚΟΝΤΑ**· `null` σε πίνακα χωρίς γραμμές/στήλες.
 *
 * Η ισοπαλία σπάει υπέρ του **οριζόντιου** συνόρου (`'down'`), και είναι απόφαση: η εισαγωγή
 * γραμμών είναι η ασυγκρίτως συχνότερη πράξη σε φύλλο υπολογισμού, και μια ισοπαλία συμβαίνει
 * **ακριβώς πάνω στη γωνία** τεσσάρων κελιών — όπου κάθε απάντηση είναι εξίσου σωστή, αλλά μία
 * μόνο είναι **σταθερή**. Χωρίς ρητό κανόνα, ο άξονας θα ταλαντωνόταν με τα αριθμητικά σφάλματα
 * του `mm` σε κάθε καρέ, δηλαδή η γραμμή-Ι θα «χτυπούσε» ανάμεσα σε δύο προσανατολισμούς.
 */
export function tableRangeInsertBoundaryAtFrame(
  layout: TableLayout,
  frame: TableFramePoint,
): TableRangeInsertBoundary | null {
  const rows = layout.rows;
  const columns = layout.columns;
  if (rows.length === 0 || columns.length === 0) return null;

  const horizontal = nearestBoundary(rows.length, (i) => rows[i].yMm, layout.heightMm, frame.v);
  const vertical = nearestBoundary(columns.length, (i) => columns[i].xMm, layout.widthMm, frame.u);

  return horizontal.distanceMm <= vertical.distanceMm
    ? { axis: 'down', line: horizontal.line }
    : { axis: 'right', line: vertical.line };
}

/**
 * 🔴 §36 ΦΑΣΗ 3 — **Η ΓΡΑΜΜΗ-Ι**: το σύνορο όπου *πραγματικά* παρεμβάλλεται η περιοχή, ως
 * **εκφυλισμένο** ορθογώνιο (μηδενικό πάχος) σε sheet-mm.
 *
 * Το πάχος **δεν** μπαίνει εδώ επίτηδες: η γραμμή-Ι είναι δείκτης **διεπαφής**, άρα το πάχος
 * της ανήκει στα px οθόνης (ίδιο επιχείρημα με το `TABLE_CELL_CURSOR.lineWidthPx`). Σε sheet-mm
 * θα γινόταν αόρατη σε zoom-out και χοντρή μπάρα σε zoom-in.
 *
 * Η **ακμή** είναι η *εισερχόμενη* πλευρά της προσγείωσης: πάνω για `'down'`, αριστερή για
 * `'right'` — δηλαδή η πλευρά που ο χρήστης βλέπει να «ανοίγει» για να δεχτεί την περιοχή.
 */
export function tableRangeInsertCaretMm(
  destinationMm: TableRectMm,
  axis: TableRangeShiftAxis,
): TableRectMm {
  const { x, y, w, h } = destinationMm;
  return axis === 'down' ? { x, y, w, h: 0 } : { x, y, w: 0, h };
}

/**
 * Το πλησιέστερο σύνορο ενός άξονα, με την απόστασή του.
 *
 * Δυαδική αναζήτηση και **όχι** γραμμική σάρωση: η ερώτηση γίνεται σε **κάθε κίνηση ποντικιού**
 * μιας σύρσης (60-120/δευτ.) και ένας πίνακας 500 γραμμών θα πλήρωνε 500 συγκρίσεις κάθε φορά —
 * ακριβώς το «δουλειά ανάλογη του μεγέθους, όχι της αλλαγής» που ο **ADR-735** πλήρωσε σε
 * παραγωγή. Ίδιο μοτίβο με το `visibleRowRange`, σε **έναν** βρόχο αντί για δύο.
 *
 * Ο προσπελαστής είναι συνάρτηση αντί για πίνακα αριθμών ώστε να μη χτίζεται πίνακας `n`
 * στοιχείων ανά κίνηση — και ώστε ο **ίδιος** κώδικας να εξυπηρετεί γραμμές (`yMm`) και στήλες
 * (`xMm`), που έχουν διαφορετικά ονόματα πεδίων.
 */
function nearestBoundary(
  count: number,
  startMm: (index: number) => number,
  endMm: number,
  atMm: number,
): { readonly line: number; readonly distanceMm: number } {
  const boundaryMm = (line: number): number => (line < count ? startMm(line) : endMm);

  // Το πρώτο σύνορο που δεν είναι πριν από το σημείο. Τα σύνορα είναι αύξοντα εξ ορισμού της
  // διάταξης (`yMm`/`xMm` αύξοντα, μη αρνητικά ύψη/πλάτη).
  let lo = 0;
  let hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (boundaryMm(mid) < atMm) lo = mid + 1;
    else hi = mid;
  }

  const after = boundaryMm(lo);
  const afterDistance = Math.abs(after - atMm);
  if (lo === 0) return { line: 0, distanceMm: afterDistance };

  const beforeDistance = Math.abs(atMm - boundaryMm(lo - 1));
  return beforeDistance < afterDistance
    ? { line: lo - 1, distanceMm: beforeDistance }
    : { line: lo, distanceMm: afterDistance };
}
