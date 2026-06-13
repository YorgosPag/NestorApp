/**
 * ADR-441 — Column justification σε «Εσχάρα από κάναβο» (3-mode → 9-position anchor).
 *
 * Μια κολώνα πατά σε **τομή 2 αξόνων**, άρα η έδρασή της προκύπτει συνθέτοντας τον ΙΔΙΟ
 * justification κανόνα (`gridStripJustification`) σε **κάθε διεύθυνση** ξεχωριστά (X & Y) →
 * ένα από τα 9 anchors (Revit «column flush to corner/edge»). Η κολώνα ΔΕΝ χρειάζεται νέο
 * μηχανισμό offset: το `anchor` (`ColumnParams.anchor` + `ANCHOR_OFFSETS`) εφαρμόζεται ήδη από
 * τη geometry ΚΑΙ επιβιώνει follow-move (position re-derive → geometry re-apply anchor), άρα
 * είναι και width-edit-safe (το offset ξανα-υπολογίζεται από το τρέχον width/depth).
 *
 * Χαρτογράφηση: ο `gridStripJustification` δίνει ποια **παρειά** κάθεται στον άξονα· το
 * πρόσημο μετατόπισης του σώματος (μέσω `JUSTIFICATION_NORMAL_SIGN` + canonical normals
 * V=(−1,0)/H=(0,1)) → ποια **ακμή/γωνία** του σώματος εδράζεται στο σημείο (= το anchor):
 *   - body +X (παρειά −X στον άξονα) → δυτική πλευρά στο σημείο → anchor 'w'/'sw'/'nw'.
 *   - body +Y → νότια πλευρά στο σημείο → anchor 's'/'sw'/'se'.
 * Εσωτερική (μη-περιμετρική) διεύθυνση → `center` → καμία μετατόπιση σε αυτή τη διεύθυνση.
 *
 * @see ./grid-justification.ts — gridStripJustification (κοινός κανόνας)
 * @see ../types/column-types.ts — ColumnAnchor, ANCHOR_OFFSETS
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { ColumnAnchor } from '../types/column-types';
import { JUSTIFICATION_NORMAL_SIGN } from '../types/foundation-types';
import {
  gridStripJustification,
  DEFAULT_GRID_PERIMETER_MODE,
  type GridPerimeterMode,
} from './grid-justification';

/**
 * Πρόσημο μετατόπισης του σώματος από (sgnX, sgnY) → ColumnAnchor (9-position).
 * `+X` → δυτική ('w') συνιστώσα anchor· `+Y` → νότια ('s'). 0 → χωρίς συνιστώσα.
 */
function anchorFromShift(sgnX: number, sgnY: number): ColumnAnchor {
  const ns = sgnY > 0 ? 's' : sgnY < 0 ? 'n' : '';
  const ew = sgnX > 0 ? 'w' : sgnX < 0 ? 'e' : '';
  return ((ns + ew) || 'center') as ColumnAnchor;
}

/**
 * Anchor μιας grid-κολώνας από τη θέση της τομής (xIndex/yIndex) στους αντίστοιχους
 * άξονες + το περιμετρικό `mode`. `center` mode ή πλήρως εσωτερική τομή → `'center'`.
 */
export function gridColumnJustification(
  xIndex: number,
  xCount: number,
  yIndex: number,
  yCount: number,
  mode: GridPerimeterMode = DEFAULT_GRID_PERIMETER_MODE,
): ColumnAnchor {
  const xFace = gridStripJustification('V', xIndex, xCount, mode);
  const yFace = gridStripJustification('H', yIndex, yCount, mode);
  // V normal=(−1,0): body shift κατά X = −sign· H normal=(0,1): body shift κατά Y = +sign.
  const sgnX = -JUSTIFICATION_NORMAL_SIGN[xFace];
  const sgnY = JUSTIFICATION_NORMAL_SIGN[yFace];
  return anchorFromShift(sgnX, sgnY);
}
