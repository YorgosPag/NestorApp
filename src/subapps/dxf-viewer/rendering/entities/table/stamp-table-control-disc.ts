/**
 * 🔴 ADR-739 §42 — **Ο ΔΙΣΚΟΣ ΧΕΙΡΙΣΤΗΡΙΟΥ**: ο κύκλος, το περίγραμμά του, και το σύμβολο μέσα
 * του. Ο ΕΝΑΣ ζωγράφος για το ⊕ της εισαγωγής και το ⊖ της διαγραφής.
 *
 * ## Γιατί εξήχθη ΠΡΙΝ γραφτεί ο δεύτερος καταναλωτής, και όχι μετά
 * Το §40.8 το έμαθε με κόστος: το `jscpd` (N.18 / CHECK 3.28) έπιασε sibling clone ανάμεσα σε
 * δύο `useEffect` που έκαναν το ίδιο πράγμα, **αφού** είχαν ήδη γραφτεί. Εδώ η δεύτερη χρήση
 * ήταν γνωστή εκ των προτέρων, οπότε ο κλώνος **δεν γεννήθηκε ποτέ**.
 *
 * Και η κοινή γνώση δεν είναι «κώδικας ζωγραφικής» — είναι **δύο κανόνες προβολής** που, αν
 * αποκλίνουν, δίνουν δύο χειριστήρια που συμπεριφέρονται αλλιώς σε **περιστραμμένο** πίνακα:
 *
 * | στοιχείο | σύστημα | γιατί |
 * |---|---|---|
 * | **κέντρο** | πλαίσιο (mm) → `toScreen` | ο δίσκος ανήκει στον πίνακα· αλλιώς δείχνει αλλού |
 * | **ακτίνα** | px οθόνης, σταθερή | στοιχείο διεπαφής — σε mm: αόρατο σε zoom-out, τεράστιο σε zoom-in |
 * | **σύμβολο** | πλαίσιο (mm) → `toScreen` | ίσιο «+» μέσα σε γερμένο πλαίσιο διαβάζεται ως ξένο σώμα |
 *
 * Ο κύκλος είναι το μόνο σχήμα χωρίς προσανατολισμό, άρα το μόνο που **μπορεί** να μείνει σε
 * px χωρίς να πει ψέματα. Κάθε άλλο σχήμα εδώ κουβαλά κατεύθυνση.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-control-disc
 * @see rendering/entities/table/stamp-table-insert-control.ts — ο ⊕ καταναλωτής
 * @see rendering/entities/table/stamp-table-delete-control.ts — ο ⊖ καταναλωτής
 * @see rendering/entities/table/stamp-table-control-glyph.ts — ο ΕΝΑΣ ζωγράφος του συμβόλου
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §40, §42
 */

import type { TableFramePoint } from '../../../types/table-entity';
// 🔴 ADR-833 Φάση 4 — το **σύμβολο** εξήχθη όταν απέκτησε τρίτο καταναλωτή χωρίς δίσκο (το ⊕
// της προσθήκης φύλλου). Ο δίσκος μένει εδώ· το `+`/`−` ζει σε ένα σημείο (N.18).
import {
  stampTableControlGlyph,
  tableControlGlyphArmPx,
  type TableControlGlyph,
} from './stamp-table-control-glyph';
import type { StampTableContext } from './stamp-table-layout';

/** Τα χρώματα και τα πάχη **μιας** φάσης — ο καλών έχει ήδη διαλέξει ποια. */
export interface TableControlDiscStyle {
  readonly fillHex: string;
  readonly lineHex: string;
  readonly glyphHex: string;
  readonly lineWidthPx: number;
  readonly glyphWidthPx: number;
}

/**
 * Ζωγραφίζει τον δίσκο και το σύμβολό του.
 *
 * Ο καλών δίνει **ήδη λυμένη** φάση (χρώματα) και **ήδη λυμένη** γεωμετρία (κέντρο σε mm): η
 * ερώτηση «πού και σε ποια κατάσταση» απαντήθηκε τη στιγμή του `mousemove` και δεν
 * ξαναρωτιέται ανά καρέ — μια δεύτερη απάντηση θα ήταν δεύτερη ευκαιρία να αποκλίνει.
 */
export function stampTableControlDisc(
  rc: StampTableContext,
  centerMm: TableFramePoint,
  radiusPx: number,
  glyph: TableControlGlyph,
  style: TableControlDiscStyle,
): void {
  const { ctx } = rc;
  const center = rc.toScreen(centerMm.u, centerMm.v);

  ctx.save();
  ctx.beginPath();
  ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  ctx.fillStyle = style.fillHex;
  ctx.fill();
  // Το περίγραμμα μπαίνει **πάντα**: πάνω σε ανοιχτόχρωμο φόντο ένας λευκός δίσκος χωρίς
  // περίγραμμα δεν έχει σχήμα, και πάνω σε σκούρο ο χρωματιστός χάνει την ακμή του.
  ctx.strokeStyle = style.lineHex;
  ctx.lineWidth = style.lineWidthPx;
  // Ρητά συμπαγές: ο `stampTableBorders` μπορεί να έχει αφήσει διακεκομμένο μοτίβο πάνω στο
  // ίδιο context — το `save/restore` προστατεύει τη ΔΙΚΗ μας κλήση, όχι την επόμενη.
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.restore();

  stampTableControlGlyph(rc, centerMm, tableControlGlyphArmPx(radiusPx), glyph, style);
}
