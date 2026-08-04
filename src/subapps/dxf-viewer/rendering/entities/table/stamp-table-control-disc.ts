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
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §40, §42
 */

import type { TableFramePoint } from '../../../types/table-entity';
import type { StampTableContext } from './stamp-table-layout';

/**
 * Το μισό μήκος κάθε σκέλους του συμβόλου, ως **κλάσμα της ακτίνας**.
 *
 * Κλάσμα και όχι δεύτερη σταθερά σε px: το σύμβολο οφείλει να μένει αναλογικό μέσα στον δίσκο
 * του. Δύο ανεξάρτητοι αριθμοί θα άφηναν το σύμβολο να ξεχειλίσει την πρώτη φορά που κάποιος
 * μικρύνει την ακτίνα — και θα το ανακάλυπτε στην οθόνη, όχι στον κώδικα.
 */
const GLYPH_ARM_RATIO = 0.5;

/** Ποιο σύμβολο μπαίνει μέσα στον δίσκο. Το `−` είναι το `+` **χωρίς** το κάθετο σκέλος. */
export type TableControlGlyph = 'plus' | 'minus';

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

  stampGlyph(rc, centerMm, radiusPx, glyph, style);
}

/**
 * Το σύμβολο, **γερμένο με τον πίνακα** — δες τον πίνακα της κεφαλίδας.
 *
 * Τα άκρα γεννιούνται σε mm γύρω από το κέντρο και προβάλλονται ένα προς ένα, ποτέ ως σταθερές
 * μετατοπίσεις πάνω στο προβεβλημένο κέντρο: η δεύτερη διαδρομή θα έδινε πάντα ίσιο σύμβολο,
 * δηλαδή θα ακύρωνε σιωπηλά την περιστροφή.
 */
function stampGlyph(
  rc: StampTableContext,
  centerMm: TableFramePoint,
  radiusPx: number,
  glyph: TableControlGlyph,
  style: TableControlDiscStyle,
): void {
  const { ctx } = rc;
  const armMm = (radiusPx * GLYPH_ARM_RATIO) / rc.pxPerMm;
  const { u, v } = centerMm;
  const left = rc.toScreen(u - armMm, v);
  const right = rc.toScreen(u + armMm, v);

  ctx.save();
  ctx.strokeStyle = style.glyphHex;
  ctx.lineWidth = style.glyphWidthPx;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  // Το κάθετο σκέλος είναι **όλη** η διαφορά ανάμεσα στα δύο σύμβολα. Δύο ξεχωριστές
  // συναρτήσεις θα ήταν δύο αντίγραφα του οριζόντιου σκέλους — και δύο ευκαιρίες να αποκλίνει
  // το μήκος του, δηλαδή ένα `+` και ένα `−` που δεν μοιάζουν αδέλφια στην οθόνη.
  if (glyph === 'plus') {
    const top = rc.toScreen(u, v - armMm);
    const bottom = rc.toScreen(u, v + armMm);
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
  }
  ctx.stroke();
  ctx.restore();
}
