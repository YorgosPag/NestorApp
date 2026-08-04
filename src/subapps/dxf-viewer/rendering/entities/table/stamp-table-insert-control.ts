/**
 * 🔴 ADR-739 §40 — **Ο ΖΩΓΡΑΦΟΣ ΤΟΥ ⊕**: ο δίσκος στο σύνορο, ο σταυρός μέσα του, και — μόνο
 * όταν το χειριστήριο είναι οπλισμένο — η γραμμή που δείχνει **πού** θα μπει η νέα
 * γραμμή/στήλη.
 *
 * Ζωγραφίζεται στο ίδιο overlay pass με τον δρομέα και τις ζώνες, **ποτέ** μέσα στο cached
 * raster της σκηνής (ADR-040 κανόνας #3): αλλιώς κάθε κίνηση ποντικιού πάνω από τον πίνακα θα
 * ακύρωνε ολόκληρο το bitmap.
 *
 * ## 🔴 ΤΙ ΓΕΡΝΕΙ ΜΕ ΤΟΝ ΠΙΝΑΚΑ ΚΑΙ ΤΙ ΟΧΙ — και γιατί η διαφορά δεν είναι αυθαίρετη
 * Ο πίνακας περιστρέφεται (λαβή `table-rotation`). Ο κανόνας εδώ είναι ο ίδιος που ήδη
 * εφαρμόζει το `stampFrameText` για τα γράμματα των ζωνών, διατυπωμένος για σχήματα:
 *
 * | στοιχείο | σύστημα | γιατί |
 * |---|---|---|
 * | **κέντρο** του δίσκου | πλαίσιο (mm) → `toScreen` | το ⊕ ανήκει σε **σύνορο** του πίνακα· αν δεν γύριζε μαζί του θα έδειχνε αλλού |
 * | **ακτίνα** του δίσκου | px οθόνης, σταθερή | στοιχείο διεπαφής — σε mm θα γινόταν αόρατο σε zoom-out και τεράστιο σε zoom-in |
 * | **σταυρός** | πλαίσιο (mm) → `toScreen` | ένα ίσιο «+» μέσα σε γερμένο πλαίσιο διαβάζεται ως ξένο σώμα, το ίδιο επιχείρημα με τα γράμματα |
 * | **γραμμή προεπισκόπησης** | πλαίσιο (mm) → `toScreen` | **είναι** το σύνορο· αν δεν έγερνε, θα υποσχόταν λάθος θέση |
 *
 * Ο κύκλος είναι το μόνο σχήμα που δεν έχει προσανατολισμό, άρα το μόνο που **μπορεί** να μείνει
 * σε px χωρίς να πει ψέματα. Κάθε άλλο σχήμα εδώ κουβαλά κατεύθυνση.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-insert-control
 * @see bim/table/table-insert-control.ts — ΠΟΥ κάθεται και ΤΙ υπόσχεται (η γεωμετρία)
 * @see rendering/entities/table/stamp-table-indicator.ts — ο αδελφός ζωγράφος των ζωνών
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §40
 */

import {
  TABLE_INSERT_CONTROL_RADIUS_PX,
  type TableInsertControlHit,
} from '../../../bim/table/table-insert-control';
import { TABLE_INSERT_CONTROL } from '../../../config/color-config';
// 🔴 §42 — ο ΕΝΑΣ δίσκος χειριστηρίου (κύκλος + σύμβολο + οι κανόνες προβολής τους), κοινός με
// το ⊖ της διαγραφής. Δες το σχόλιο στο {@link stampInsertDisc} για το γιατί εξήχθη.
import { stampTableControlDisc } from './stamp-table-control-disc';
import type { StampTableContext } from './stamp-table-layout';

/** Το μέγεθος του πίνακα, όσο χρειάζεται για να τραβηχτεί η γραμμή προεπισκόπησης άκρη σε άκρη. */
export interface TableInsertControlSpanMm {
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * Ζωγραφίζει το χειριστήριο. Ο καλών το επιτρέπει μόνο όταν ο πίνακας είναι επιλεγμένος ή
 * ανοιχτός — δηλαδή στις δύο καταστάσεις που ορίζει το `TableInsertControlMode`.
 *
 * Η σειρά είναι **γραμμή → δίσκος**: η γραμμή προεπισκόπησης ξεκινά από το σύνορο και ο δίσκος
 * κάθεται πάνω στην αφετηρία της. Ανάποδα, η γραμμή θα διέσχιζε τον σταυρό και το ⊕ θα
 * διαβαζόταν ως «διαγραμμένο» ακριβώς τη στιγμή που ενεργοποιείται.
 */
export function stampTableInsertControl(
  rc: StampTableContext,
  control: TableInsertControlHit,
  span: TableInsertControlSpanMm,
): void {
  if (control.phase === 'armed') stampInsertCaret(rc, control, span);
  stampInsertDisc(rc, control);
}

/**
 * Η γραμμή προεπισκόπησης: **ολόκληρο** το σύνορο, από άκρη σε άκρη του πίνακα.
 *
 * Ολόκληρο και όχι ένα κοντό σημάδι, επειδή αυτό ακριβώς απαντά στην ερώτηση που έχει ο
 * χρήστης τη στιγμή που στοχεύει: *«ανάμεσα σε ποιες δύο;»*. Σε πίνακα με στενές στήλες, ένα
 * σημάδι μήκους 10 px δίπλα στον δίσκο αφήνει την ερώτηση ανοιχτή — και είναι το σχήμα που το
 * ίδιο το Word ζωγραφίζει (η γκρίζα κατακόρυφη γραμμή σε όλο το ύψος).
 */
function stampInsertCaret(
  rc: StampTableContext,
  control: TableInsertControlHit,
  span: TableInsertControlSpanMm,
): void {
  const { ctx } = rc;
  const isColumn = control.target.axis === 'column';
  const from = isColumn
    ? rc.toScreen(control.boundaryMm, 0)
    : rc.toScreen(0, control.boundaryMm);
  const to = isColumn
    ? rc.toScreen(control.boundaryMm, span.heightMm)
    : rc.toScreen(span.widthMm, control.boundaryMm);

  ctx.save();
  ctx.strokeStyle = TABLE_INSERT_CONTROL.caretHex;
  ctx.lineWidth = TABLE_INSERT_CONTROL.caretWidthPx;
  // Ρητά συμπαγής: ο `stampTableBorders` μπορεί να έχει αφήσει διακεκομμένο μοτίβο πάνω στο
  // ίδιο context — το `save/restore` προστατεύει τη ΔΙΚΗ μας κλήση, όχι την επόμενη.
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Ο δίσκος με τον σταυρό — τα χρώματα βγαίνουν από τη **φάση**, όχι από τον καλούντα.
 *
 * ⚠️ §42 — ο δίσκος και το σύμβολο **μετακόμισαν** στο `stamp-table-control-disc.ts` τη στιγμή
 * που γεννήθηκε ο δεύτερος καταναλωτής (το ⊖ της διαγραφής). Δεν ήταν φορμαλισμός του CHECK
 * 3.28: η κοινή γνώση είναι οι **κανόνες προβολής** (τι γέρνει με τον πίνακα και τι μένει σε
 * px) — δύο αντίγραφά τους σημαίνουν δύο χειριστήρια που συμπεριφέρονται αλλιώς σε
 * περιστραμμένο πίνακα, και το ένα από τα δύο θα το ανακάλυπτε ο χρήστης.
 *
 * Εδώ μένει **μόνο** η επιλογή φάσης: η γνώση που είναι όντως του ⊕.
 */
function stampInsertDisc(rc: StampTableContext, control: TableInsertControlHit): void {
  const armed = control.phase === 'armed';
  stampTableControlDisc(rc, control.centerMm, TABLE_INSERT_CONTROL_RADIUS_PX, 'plus', {
    fillHex: armed ? TABLE_INSERT_CONTROL.armedFillHex : TABLE_INSERT_CONTROL.fillHex,
    lineHex: armed ? TABLE_INSERT_CONTROL.armedGlyphHex : TABLE_INSERT_CONTROL.lineHex,
    glyphHex: armed ? TABLE_INSERT_CONTROL.armedGlyphHex : TABLE_INSERT_CONTROL.glyphHex,
    lineWidthPx: TABLE_INSERT_CONTROL.lineWidthPx,
    glyphWidthPx: TABLE_INSERT_CONTROL.glyphWidthPx,
  });
}
