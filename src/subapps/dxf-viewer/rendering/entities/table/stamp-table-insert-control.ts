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
import type { StampTableContext } from './stamp-table-layout';

/**
 * Το μισό μήκος κάθε σκέλους του σταυρού, ως **κλάσμα της ακτίνας**.
 *
 * Κλάσμα και όχι δεύτερη σταθερά σε px: ο σταυρός οφείλει να μένει αναλογικός μέσα στον δίσκο
 * του. Δύο ανεξάρτητοι αριθμοί θα άφηναν τον σταυρό να ξεχειλίσει την πρώτη φορά που κάποιος
 * μικρύνει την ακτίνα — και θα το ανακάλυπτε στην οθόνη, όχι στον κώδικα.
 */
const GLYPH_ARM_RATIO = 0.5;

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

/** Ο δίσκος με τον σταυρό — τα δύο χρώματα βγαίνουν από τη φάση, όχι από τον καλούντα. */
function stampInsertDisc(rc: StampTableContext, control: TableInsertControlHit): void {
  const { ctx } = rc;
  const armed = control.phase === 'armed';
  const center = rc.toScreen(control.centerMm.u, control.centerMm.v);

  ctx.save();
  ctx.beginPath();
  ctx.arc(center.x, center.y, TABLE_INSERT_CONTROL_RADIUS_PX, 0, Math.PI * 2);
  ctx.fillStyle = armed ? TABLE_INSERT_CONTROL.armedFillHex : TABLE_INSERT_CONTROL.fillHex;
  ctx.fill();
  // Το περίγραμμα μπαίνει και στις δύο φάσεις: πάνω σε ανοιχτόχρωμο σχέδιο ένας λευκός δίσκος
  // χωρίς περίγραμμα δεν έχει σχήμα, και πάνω σε σκούρο ο μπλε χάνει την ακμή του.
  ctx.strokeStyle = armed ? TABLE_INSERT_CONTROL.armedGlyphHex : TABLE_INSERT_CONTROL.lineHex;
  ctx.lineWidth = TABLE_INSERT_CONTROL.lineWidthPx;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.restore();

  stampInsertGlyph(rc, control, armed);
}

/**
 * Ο σταυρός, **γερμένος με τον πίνακα** — δες τον πίνακα της κεφαλίδας.
 *
 * Τα τέσσερα άκρα γεννιούνται σε mm γύρω από το κέντρο και προβάλλονται ένα προς ένα, ποτέ ως
 * σταθερές μετατοπίσεις πάνω στο προβεβλημένο κέντρο: η δεύτερη διαδρομή θα έδινε πάντα ίσιο
 * σταυρό, δηλαδή θα ακύρωνε σιωπηλά την περιστροφή.
 */
function stampInsertGlyph(
  rc: StampTableContext,
  control: TableInsertControlHit,
  armed: boolean,
): void {
  const { ctx } = rc;
  const armMm = (TABLE_INSERT_CONTROL_RADIUS_PX * GLYPH_ARM_RATIO) / rc.pxPerMm;
  const { u, v } = control.centerMm;
  const left = rc.toScreen(u - armMm, v);
  const right = rc.toScreen(u + armMm, v);
  const top = rc.toScreen(u, v - armMm);
  const bottom = rc.toScreen(u, v + armMm);

  ctx.save();
  ctx.strokeStyle = armed ? TABLE_INSERT_CONTROL.armedGlyphHex : TABLE_INSERT_CONTROL.glyphHex;
  ctx.lineWidth = TABLE_INSERT_CONTROL.glyphWidthPx;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.stroke();
  ctx.restore();
}
