'use client';

/**
 * ADR-833 Φάσεις 3+4 — **ΤΙ ΤΗΣ ΛΩΡΙΔΑΣ ΦΥΛΛΩΝ ΕΙΝΑΙ ΚΑΤΩ ΑΠΟ ΤΟ ΣΗΜΕΙΟ;** (καρτέλα ή ⊕)
 *
 * Δικό του module και όχι άλλη μια ιδιωτική συνάρτηση μέσα στο `table-cell-pointer-hit.ts`,
 * για δύο ανεξάρτητους λόγους — και ο πρώτος είναι ο πεζός:
 *
 *  1. **Μέγεθος (N.7.1).** Ο χάρτης χτυπημάτων ήταν στις **485/500** γραμμές πριν από τη
 *     Φάση 3. Το handoff το είχε μετρήσει και το είχε ονομάσει: *«αν η Φάση 3 χρειαστεί έστω
 *     μία γραμμή, η σωστή κίνηση είναι ΕΞΑΓΩΓΗ»*. Ίδιο σχήμα με τα `table-corner-pointer.ts`,
 *     `table-move-drag.ts`, `table-axis-resize-drag.ts`.
 *  2. **Δεύτερος καταναλωτής, ήδη γνωστός.** Την ίδια ερώτηση κάνουν ο χάρτης χτυπημάτων
 *     (για τον φύλακα του §29 και τον pointer) **και** ο hover (για το φωτισμένο κουτί). Δύο
 *     αντίγραφα θα ήταν ο sibling clone του N.18 — και το ακριβό δεν είναι οι γραμμές: είναι
 *     ότι η **σάρωση** και το **παράθυρο υπερχείλισης** πρέπει να είναι τα ίδια, αλλιώς ο
 *     δείκτης φωτίζει καρτέλα που δεν ζωγραφίστηκε ποτέ.
 *
 * 🔑 **ΔΕΝ ξαναγράφει γεωμετρία.** Δανείζεται τη βάση ({@link indicatorProbeBasis} — μία
 * απάντηση για το LOD, κοινή με κάθε άλλη ερώτηση δείκτη) και ρωτά την **ίδια** λωρίδα
 * (`TableWorksheetStrip`) που καταναλώνει ο ζωγράφος. Ό,τι πατιέται είναι ό,τι φαίνεται —
 * δομικά, όχι κατά σύμβαση.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-worksheet-tab-probe
 * @see bim/table/table-worksheet-tabs-geometry.ts — η ΜΙΑ διάταξη της λωρίδας
 * @see rendering/entities/table/stamp-table-chrome.ts — ο ζωγράφος, με την ίδια κλήση
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.3
 */

import { indicatorProbeBasis } from './table-indicator-probe-basis';
import { resolveWorksheetFields } from '../../bim/table/table-worksheet-resolve';
import {
  tableWorksheetStripAtFrame,
  tableWorksheetTabStrip,
  type TableWorksheetStripHit,
} from '../../bim/table/table-worksheet-tabs-geometry';
import type { Point2D } from '../../rendering/types/Types';
import type { TableEntity, TableEntityGeometry } from '../../types/table-entity';

/**
 * Τι είναι κάτω από το σημείο **μέσα στη λωρίδα** — καρτέλα, το ⊕, ή `null` (κάτω από το LOD,
 * έξω από τη λωρίδα, ή σε πίνακα που δεν έχει λωρίδα καθόλου).
 *
 * ⚠️ Η γεωμετρία έρχεται ως όρισμα και **δεν** υπολογίζεται εδώ: και οι δύο καλούντες την
 * έχουν ήδη υπολογίσει μία φορά για ολόκληρη τη σάρωσή τους. Ένα `computeTableEntityGeometryLive`
 * εδώ θα ήταν δεύτερος υπολογισμός διάταξης **ανά κίνηση ποντικιού** — ακριβώς το κόστος που
 * ο χάρτης χτυπημάτων απέφυγε ρητά όταν εξήγαγε τη βάση του.
 */
export function tableWorksheetStripAtWorld(
  entity: TableEntity,
  world: Point2D,
  geometry: TableEntityGeometry,
  viewScale: number,
): TableWorksheetStripHit | null {
  const probe = indicatorProbeBasis(entity, world, geometry, viewScale);
  if (!probe) return null;
  // 🔴 Η ΜΙΑ ΠΥΛΗ των φύλλων, ποτέ ωμό `entity.worksheets`: μια οντότητα της παλιάς μορφής δεν
  // έχει κανένα από τα δύο πεδία, και η ωμή ανάγνωση θα έδινε «μηδέν φύλλα» — δηλαδή λωρίδα
  // ζωγραφισμένη (ο ζωγράφος ρωτά σωστά) και **απίαστη**. Ακριβώς το σχήμα του §40.8.
  const { worksheets, activeWorksheetId } = resolveWorksheetFields(entity);
  const strip = tableWorksheetTabStrip(
    worksheets,
    activeWorksheetId,
    geometry.layout.widthMm,
    geometry.layout.heightMm,
    probe.pxPerMm,
  );
  return tableWorksheetStripAtFrame(strip, probe.frame);
}
