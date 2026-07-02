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
 *   3. §5.6c ΓΕΝΙΚΟ: κάθε τύπος (Γ/Τ/Π/Ι/πολύγωνο/σύνθετη/τοιχίο) που εισάγει νέα
 *            παραβίαση «σχέσης» διατομής (γεωμετρική εκφύλιση / λυγηρότητα / ρ) →
 *            SOFT confirm «Συνέχεια / Άκυρο» (ΠΛΗΡΗΣ έλεγχος, incl. οπλισμό).
 *   4. αλλιώς → κατευθείαν finalize (μηδέν dialog, μηδέν latency).
 *
 * @see ./column-aspect.ts (detector §5.6) · ./shear-wall-extents.ts (detector §5.6b)
 * @see ./section-relationship-warning.ts (detector §5.6c — validator-driven, όλοι οι τύποι)
 */

import type { ColumnParams } from '../types/column-types';
import {
  detectColumnBecomesWall,
  reclassifyRectToShearWall,
} from './column-aspect';
import { requestColumnBecomesWallConfirm } from './column-becomes-wall-confirm-store';
import { detectMemberExtentCrossing } from './shear-wall-extents';
import { requestShearWallExtentConfirm } from './shear-wall-extent-confirm-store';
import { detectColumnRelationshipWarning } from './section-relationship-warning';
import { requestSectionRelationshipConfirm } from './section-relationship-confirm-store';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';

/**
 * Εφαρμόζει τους §5.6/§5.6b/§5.6c guards πάνω στη μετάβαση `prevParams → nextParams` και καλεί το
 * `finalize` με τις τελικές params (ή καθόλου, αν ο χρήστης ακυρώσει σε οποιοδήποτε βήμα).
 *
 * ΣΕΙΡΙΑΚΗ ΑΛΥΣΙΔΑ (Giorgio §5.6c B): σε μία ενέργεια μπορεί να ισχύουν ΠΕΡΙΣΣΟΤΕΡΑ advisory (π.χ.
 * επιμήκυνση→σαν τοιχίο ΚΑΙ μήκος>30m→αρμός διαστολής). Τα δείχνουμε ΔΙΑΔΟΧΙΚΑ (όχι early-return στο
 * πρώτο) ώστε να μη «κρύβεται» το ένα πίσω από το άλλο. Κάθε βήμα crossing-only (μηδέν re-nag)· ο
 * becomesWall μπορεί να μετασχηματίσει τις params (reclassify ορθογωνίου σε τοιχίο) → τα επόμενα βήματα
 * αξιολογούνται στο ΤΕΛΙΚΟ σχήμα. 'cancel' σε οποιοδήποτε βήμα → πλήρης ακύρωση (μηδέν finalize).
 */
export function runColumnEditGuards(
  prevParams: ColumnParams,
  nextParams: ColumnParams,
  finalize: (params: ColumnParams) => void,
): void {
  void runGuardChain(prevParams, nextParams, finalize);
}

async function runGuardChain(
  prevParams: ColumnParams,
  nextParams: ColumnParams,
  finalize: (params: ColumnParams) => void,
): Promise<void> {
  let finalParams = nextParams;

  // 1) §5.6/§5.6c B — «η διατομή έγινε πολύ επιμήκης → σαν τοιχίο», ΓΕΝΙΚΟ για όλους τους τύπους.
  //    Ορθογώνιο → «Μετατροπή σε τοιχίο» (canReclassify)· Γ/Τ/Π/Ι/σύνθετη → advisory (Συνέχεια/Άκυρο).
  const becomesWall = detectColumnBecomesWall(prevParams, nextParams);
  if (becomesWall) {
    const action = await requestColumnBecomesWallConfirm({
      aspect: becomesWall.aspect,
      longSideMm: becomesWall.longSideMm,
      shortSideMm: becomesWall.shortSideMm,
      canReclassify: becomesWall.canReclassify,
    });
    if (action === 'cancel') return;
    // 'convert' φτάνει ΜΟΝΟ όταν canReclassify (ορθογώνιο) — το dialog κρύβει το κουμπί αλλιώς.
    if (action === 'convert') finalParams = reclassifyRectToShearWall(finalParams);
  }

  // 2) §5.6b/§5.6c B — ασυνήθιστες διαστάσεις μέλους (πάχος > 1.5m / μήκος > 30m → αρμός), ΚΑΘΕ τύπος.
  const extent = detectMemberExtentCrossing(prevParams, finalParams);
  if (extent) {
    const action = await requestShearWallExtentConfirm(extent);
    if (action === 'cancel') return;
  }

  // 3) §5.6c A — ΓΕΝΙΚΟΣ έλεγχος «σχέσεων» (validator-driven). Στο release/commit τρέχει ΠΛΗΡΗΣ
  //    (includeReinforcement:true) — μία κλήση, ADR-040 safe (το live-ghost gate μένει φθηνό).
  const relationship = detectColumnRelationshipWarning(prevParams, finalParams, {
    includeReinforcement: true,
    codeId: useStructuralSettingsStore.getState().codeId,
  });
  if (relationship) {
    const action = await requestSectionRelationshipConfirm(relationship);
    if (action === 'cancel') return;
  }

  finalize(finalParams);
}
