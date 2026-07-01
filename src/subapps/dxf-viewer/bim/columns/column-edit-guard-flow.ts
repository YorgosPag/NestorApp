/**
 * ADR-363 §5.6 / §5.6b — SSoT edit-time guard flow για αλλαγή διαστάσεων κολόνας.
 *
 * Το ΙΔΙΟ non-blocking μοτίβο εφαρμόζεται σε ΔΥΟ paths (αριθμητικό panel+ribbon →
 * `useColumnParamsDispatcher`, grip-resize → `commitColumnGripDrag`). Εξάχθηκε εδώ
 * ώστε να υπάρχει ΕΝΑ σημείο αλήθειας για τη σειρά ελέγχων:
 *   1. §5.6  κολόνα→τοιχίο (rounded aspect > 4, EC2 §9.6.1 / EC8 §5.4.2.4) →
 *            confirm «Μετατροπή / Κράτημα / Άκυρο».
 *   2. §5.6b τοιχίο με ασυνήθιστο πάχος (>1.5m) ή μήκος (>30m) → SOFT confirm
 *            «Συνέχεια / Άκυρο» (ΠΟΤΕ block — οι Ευρωκώδικες δεν ορίζουν μέγιστο).
 *   3. αλλιώς → κατευθείαν finalize (μηδέν dialog, μηδέν latency).
 *
 * @see ./column-aspect.ts (detector §5.6) · ./shear-wall-extents.ts (detector §5.6b)
 */

import type { ColumnParams } from '../types/column-types';
import {
  detectRectColumnBecomesWall,
  reclassifyRectToShearWall,
} from './column-aspect';
import { requestColumnBecomesWallConfirm } from './column-becomes-wall-confirm-store';
import { detectShearWallExtentCrossing } from './shear-wall-extents';
import { requestShearWallExtentConfirm } from './shear-wall-extent-confirm-store';

/**
 * Εφαρμόζει τους §5.6/§5.6b guards πάνω στη μετάβαση `prevParams → nextParams` και
 * καλεί το `finalize` με τις τελικές params (ή καθόλου, αν ο χρήστης ακυρώσει).
 * Crossing-only detectors → μηδέν re-nag· non-crossing → άμεσο finalize.
 */
export function runColumnEditGuards(
  prevParams: ColumnParams,
  nextParams: ColumnParams,
  finalize: (params: ColumnParams) => void,
): void {
  const becomesWall = detectRectColumnBecomesWall(prevParams, nextParams);
  if (becomesWall) {
    void requestColumnBecomesWallConfirm({
      aspect: becomesWall.aspect,
      longSideMm: becomesWall.longSideMm,
      shortSideMm: becomesWall.shortSideMm,
    }).then((action) => {
      if (action === 'cancel') return;
      finalize(action === 'convert' ? reclassifyRectToShearWall(nextParams) : nextParams);
    });
    return;
  }
  const extent = detectShearWallExtentCrossing(prevParams, nextParams);
  if (extent) {
    void requestShearWallExtentConfirm(extent).then((action) => {
      if (action === 'cancel') return;
      finalize(nextParams);
    });
    return;
  }
  finalize(nextParams);
}
