/**
 * ADR-662 §13 — commit της λαβής τοπογραφικής επιφάνειας.
 *
 * Ο **μοναδικός** grip commit του υποσυστήματος που δεν κάνει patch την οντότητα που
 * κρατάει τη λαβή: γράφει στο **survey point** (`TopoPointStore`) και αφήνει το `footprint`
 * να ξαναπαραχθεί από την TIN. Η επιφάνεια είναι derived — ένα patch στο περίγραμμα θα
 * εξατμιζόταν στην επόμενη αναδημιουργία (βλ. `topo-surface-grips` για το πλήρες σκεπτικό
 * και την έρευνα Civil 3D / Revit / ArchiCAD).
 *
 * **ΤΑ ΔΥΟ ΠΛΑΙΣΙΑ.** Η λαβή, το ποντίκι και το Shift ζουν στο **DISPLAY** frame· ο store
 * στο **WORLD** (ΕΓΣΑ). Ο περιορισμός Shift εφαρμόζεται **πριν** τη μετατροπή, στο πλαίσιο
 * που βλέπει ο χρήστης — αλλιώς σε στραμμένη geo-reference ο «οριζόντιος» άξονας της οθόνης
 * θα κούμπωνε σε λοξή διεύθυνση του εδάφους και το ortho θα φαινόταν σπασμένο.
 *
 * @see ../../systems/topography/topo-surface-grips — παραγωγή λαβών + preview
 * @see ../../core/commands/entity-commands/MoveTopoSurveyPointCommand — η undoable γραφή
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import type { TopoSurfaceEntity } from '../../types/topo-surface';
import { gripKindOf } from '../grip-kinds';
import { createSceneManagerAdapter } from './grip-scene-manager-adapter';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import { constrainDeltaToDominantAxis } from '../../bim/grips/ortho-delta';
import { decodeTopoVertexGripKind } from '../../systems/topography/topo-surface-grips';
import {
  resolveSurveyPointIndexAt,
  displayDeltaToWorld,
} from '../../systems/topography/topo-survey-point-resolve';
import { MoveTopoSurveyPointCommand } from '../../core/commands/entity-commands/MoveTopoSurveyPointCommand';

/** Η κορυφή `[ringIdx][vertexIdx]` του footprint, ή `null` σε εκτός-ορίων δείκτη. */
function footprintVertexAt(
  entity: TopoSurfaceEntity,
  ringIdx: number,
  vertexIdx: number,
): Point2D | null {
  const ring = entity.footprint[ringIdx];
  if (!ring) return null;
  return ring[vertexIdx] ?? null;
}

/**
 * ADR-662 §13 — σύρσιμο κορυφής περιγράμματος → μετακίνηση του **αντίστοιχου survey point**
 * (planimetric· το υψόμετρο δεν αγγίζεται). Το merge window (ADR-031) συμπτύσσει το συνεχές
 * σύρσιμο σε **ένα** undo.
 *
 * Κάθε πρόωρη έξοδος είναι σιωπηλή **by design**: η λαβή παράγεται μόνο για επιλύσιμες
 * κορυφές (`topoSurfaceVertexGrips`), οπότε αν φτάσουμε εδώ και κάτι δεν λύνεται, η σκηνή
 * άλλαξε κάτω από τα πόδια μας (π.χ. re-generate ενόσω κρατούσαμε τη λαβή) — και το σωστό
 * είναι να μη γραφτεί τίποτα, όχι να γραφτεί κάτι σε λάθος σημείο.
 */
export function commitTopoSurfaceGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  const kind = gripKindOf(grip, 'topo-surface');
  if (!grip.entityId || !kind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<TopoSurfaceEntity>;
  if (candidate.type !== 'topo-surface' || !candidate.footprint || !candidate.surfaceId) return;
  const entity = candidate as TopoSurfaceEntity;

  const decoded = decodeTopoVertexGripKind(kind);
  if (!decoded) return;
  const vertex = footprintVertexAt(entity, decoded[0], decoded[1]);
  if (!vertex) return;

  const pointIndex = resolveSurveyPointIndexAt(entity.surfaceId, vertex);
  if (pointIndex === null) return;

  // Shift = rectilinear, στο πλαίσιο της οθόνης· μετά (και μόνο μετά) στο πλαίσιο του κόσμου.
  const displayDelta = ShiftKeyTracker.getSnapshot()
    ? constrainDeltaToDominantAxis(delta)
    : delta;
  const command = MoveTopoSurveyPointCommand.fromDrag(
    entity.surfaceId,
    entity.id,
    pointIndex,
    displayDeltaToWorld(displayDelta),
    sceneManager,
    true,
  );
  if (!command) return; // μηδενική μετατόπιση → καμία εγγραφή στο ιστορικό
  deps.execute(command);
}
