/**
 * ADR-739 Φάση Γ / ADR-750 Φ5 — **το πλέγμα του πίνακα στον καμβά**.
 *
 * Εξήχθη από το `stamp-table-layout.ts` όταν εκείνο πέρασε τις 500 γραμμές (N.7.1). Η τομή
 * ακολουθεί τη μόνη πραγματική εξάρτηση που ξεχωρίζει: το πλέγμα είναι το **μόνο** κομμάτι
 * της ζωγραφικής πίνακα που ρωτά τον κατάλογο τύπων γραμμής (`dashMmToScreenPx`)· τα
 * γεμίσματα, οι δείκτες και το κείμενο μιλούν μόνο τη γλώσσα του καμβά.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-borders
 * @see rendering/linetype-dash-resolver.ts — ο ΕΝΑΣ μεταφραστής mm → `setLineDash`
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §19.2
 */

import type { TableBorderSegment } from '../../../bim/table/table-layout-types';
// 🔴 ADR-739 §37 — το πάχος στην οθόνη **δεν** υπολογίζεται πια εδώ: το ρωτά και ο δείκτης
// λειτουργίας, που πρέπει να μείνει έξω από αυτό το μολύβι. Δύο αντίγραφα του κανόνα θα
// σήμαιναν δείκτη που νομίζει ότι απομακρύνθηκε ενώ η γραμμή μεγάλωσε.
import { tableBorderScreenPx } from '../../../bim/table/table-border-pen';
import { dashMmToScreenPx } from '../../linetype-dash-resolver';
import type { StampTableContext } from './stamp-table-layout';

/**
 * Το LTSCALE ενός περιγράμματος πίνακα. Δες {@link stampTableBorders} για το γιατί είναι
 * σταθερά και όχι ανάγνωση του `LinetypeScaleStore`.
 */
const SHEET_LINETYPE_SCALE = 1;

/**
 * Τα τμήματα περιγράμματος, το καθένα με το δικό του μολύβι (χρώμα/πάχος/διακεκομμένη).
 *
 * ## 🔴 ADR-750 Φ5 — το μοτίβο περνά από το SSoT, ΟΧΙ από δεύτερο πολλαπλασιασμό
 * Εδώ έγραφε `dashMm.map((d) => d * pxPerMm)`. Ήταν **λανθάνον** ελάττωμα, αόρατο επειδή μέχρι
 * τη Φ5 **κανένα** preset δεν παρήγαγε `dashMm` (μετρημένο: μηδέν παραγωγοί σε όλο το δέντρο)
 * — δηλαδή το κλασικό «0 = κανείς δεν κοίταξε». Μόλις ο χρήστης απέκτησε επιλογέα στυλ
 * γραμμής, το μοτίβο άρχισε να έρχεται από τον κατάλογο, όπου τα **κενά είναι αρνητικά**
 * (`[12.7, -6.35]`, σύμβαση DXF/`.lin`). Το `setLineDash` με αρνητικό μήκος **αγνοεί ολόκληρο
 * τον πίνακα**: η διακεκομμένη θα ζωγραφιζόταν συμπαγής, χωρίς κανένα σφάλμα πουθενά.
 *
 * Το {@link dashMmToScreenPx} είναι ο μόνος νόμιμος μεταφραστής (διπλώνει τα αρνητικά,
 * ανυψώνει τις κουκκίδες σε ορατό μήκος) και είναι ο ίδιος που χρησιμοποιούν ο `DxfRenderer`
 * και τα thumbnails του ribbon — δηλαδή η διακεκομμένη του πίνακα δεν μπορεί να διαφωνήσει με
 * τη διακεκομμένη μιας γραμμής δίπλα του.
 *
 * ⚠️ Το LTSCALE περνά ως **1** επίτηδες: είναι διακόπτης του **χώρου μοντέλου** (AutoCAD
 * `LTSCALE`), ενώ ο πίνακας ζει σε sheet-mm και το `pxPerMm` του είναι ήδη η πλήρης κλίμακα
 * φύλλο→οθόνη. Ένα καθολικό LTSCALE εδώ θα άλλαζε το μοτίβο του πίνακα επειδή κάποιος πείραξε
 * τις γραμμές του σχεδίου.
 */
export function stampTableBorders(
  rc: StampTableContext,
  segments: readonly TableBorderSegment[],
): void {
  const { ctx } = rc;
  for (const segment of segments) {
    if (!segment.spec.visible) continue;
    const a = rc.toScreen(segment.a.x, segment.a.y);
    const b = rc.toScreen(segment.b.x, segment.b.y);
    ctx.save();
    ctx.strokeStyle = rc.phaseColor ?? segment.spec.colorHex;
    ctx.lineWidth = tableBorderScreenPx(segment.spec.widthMm, rc.pxPerMm);
    if (segment.spec.dashMm) {
      ctx.setLineDash(dashMmToScreenPx(segment.spec.dashMm, rc.pxPerMm, SHEET_LINETYPE_SCALE));
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
}
