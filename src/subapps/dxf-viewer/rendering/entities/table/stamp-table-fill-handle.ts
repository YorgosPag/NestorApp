/**
 * 🔴 ADR-754 **Γ4** — **η λαβή συμπλήρωσης**: το τετράγωνο στην κάτω δεξιά γωνία της επιλογής,
 * και το διακεκομμένο περίγραμμα που υπόσχεται όσο τη σέρνεις.
 *
 * ## Καμία γνώση, μόνο μελάνι
 * Ίδιο συμβόλαιο με τους αδελφούς του (`stamp-table-indicator`, `stamp-table-insert-control`):
 * το «πού κάθεται» και το «ποια κελιά υπόσχεται» τα απαντά το καθαρό `table-fill-handle.ts`.
 * Εδώ μένει μόνο το «πώς φαίνεται».
 *
 * ## 🔴 Το τετράγωνο ζωγραφίζεται σε **mm**, όχι σε px γύρω από προβεβλημένο κέντρο
 * Οι τέσσερις κορυφές γεννιούνται σε συντεταγμένες πλαισίου και προβάλλονται **μία προς μία**.
 * Η εύκολη εναλλακτική —προβάλλω το κέντρο και προσθέτω ±3 px— θα έδινε πάντα **ίσιο**
 * τετράγωνο, δηλαδή θα ακύρωνε σιωπηλά την περιστροφή του πίνακα. Είναι το ίδιο μάθημα που
 * κωδικοποιεί ήδη ο σταυρός του ⊕ (ADR-739 §40).
 *
 * ## 🔴 ΠΟΤΕ μέσα στο bitmap cache — ADR-040 κανόνας #3
 * Ζωγραφίζεται **μόνο** στο overlay pass της επιλεγμένης οντότητας, όπως ο δρομέας κελιού και
 * τα περιγράμματα αναφορών. Ο φύλακας είναι το `if (cursor)` του καλούντος.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-fill-handle
 * @see bim/table/table-fill-handle.ts — πού κάθεται, τι υπόσχεται
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §13
 */

import { TABLE_FILL_HANDLE } from '../../../config/color-config';
import { strokeRectMm, type StampTableContext } from './stamp-table-layout';
import { tableRangeRectMm } from '../../../bim/table/table-cell-range';
import { tableFillHandleRectMm } from '../../../bim/table/table-fill-handle';
import type { TableCellRangeBounds } from '../../../bim/table/table-cell-range';
import type { TableLayout } from '../../../bim/table/table-layout-types';

/**
 * Η λαβή της περιοχής. Σιωπά όταν η περιοχή δεν τέμνει τη διάταξη — μπαγιάτικη επιλογή μετά
 * από undo ή διαγραφή γραμμής.
 */
export function stampTableFillHandle(
  rc: StampTableContext,
  layout: TableLayout,
  bounds: TableCellRangeBounds,
): void {
  const rect = tableFillHandleRectMm(layout, bounds, rc.pxPerMm);
  if (!rect) return;

  const { ctx } = rc;
  // Οι τέσσερις κορυφές σε mm, προβεβλημένες ξεχωριστά — δες την κεφαλίδα.
  const corners = [
    rc.toScreen(rect.x, rect.y),
    rc.toScreen(rect.x + rect.w, rect.y),
    rc.toScreen(rect.x + rect.w, rect.y + rect.h),
    rc.toScreen(rect.x, rect.y + rect.h),
  ];

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fillStyle = TABLE_FILL_HANDLE.fillHex;
  ctx.fill();
  // Ρητά συμπαγές: ο `stampTableBorders` μπορεί να έχει αφήσει διακεκομμένο μοτίβο πάνω στο
  // ίδιο context — το `save/restore` προστατεύει τη ΔΙΚΗ μας κλήση, όχι την επόμενη.
  ctx.setLineDash([]);
  ctx.strokeStyle = TABLE_FILL_HANDLE.outlineHex;
  ctx.lineWidth = TABLE_FILL_HANDLE.outlineWidthPx;
  ctx.stroke();
  ctx.restore();
}

/**
 * Το διακεκομμένο περίγραμμα της **προεπισκόπησης** — η ένωση πηγής και γεμίσματος, όσο το
 * κουμπί είναι κάτω.
 *
 * Διακεκομμένο και όχι συμπαγές: το συμπαγές μπλε σημαίνει ήδη «εδώ πάει το πλήκτρο» σε αυτόν
 * τον πίνακα (δρομέας, περίγραμμα επιλογής). Μια υπόσχεση δεν είναι κατάσταση, και δεν
 * επιτρέπεται να μοιάζει με κατάσταση.
 *
 * Καμία δεύτερη υλοποίηση `setLineDash`: καλείται το υπάρχον {@link strokeRectMm}, ο ίδιος που
 * εξυπηρετεί το φάντασμα μεταφοράς και τα περιγράμματα αναφορών (N.18 / CHECK 3.28).
 */
export function stampTableFillPreview(
  rc: StampTableContext,
  layout: TableLayout,
  bounds: TableCellRangeBounds,
): void {
  const rect = tableRangeRectMm(layout, bounds);
  if (!rect) return;
  strokeRectMm(
    rc,
    rect,
    TABLE_FILL_HANDLE.previewHex,
    TABLE_FILL_HANDLE.previewWidthPx,
    TABLE_FILL_HANDLE.previewDashPx,
  );
}
