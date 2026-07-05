/**
 * Member Grip Corner Projection Snap — generic SSoT for κολόνα · δοκός · θεμέλιο
 * (ADR-398 column → γενίκευση, sibling του ADR-371 wall face-corner).
 *
 * Όταν σέρνεις ένα φέρον μέλος από λαβή (ή Alt+drag ολόκληρου του σώματος), ο cursor
 * κάθεται στη βάση/λαβή — ΟΧΙ σε γωνία. Αυτό το module προβάλλει τις ΔΙΚΕΣ ΤΟΥ
 * footprint-γωνίες στις προτεινόμενες θέσεις τους, ρωτά τον ενιαίο snap engine αν
 * κάποια γωνία κουμπώνει σε γειτονικό στόχο, και επιστρέφει τη διόρθωση cursor ώστε η
 * γωνία να κάτσει ΑΚΡΙΒΩΣ επάνω του — πανομοιότυπα με τον τοίχο/κολόνα.
 *
 * SSoT (μηδέν επαναϋλοποιημένη γεωμετρία): για κάθε τύπο μέλους χρησιμοποιεί τον ΙΔΙΟ
 * grip-drag transform που κάνει το commit (`applyColumnGripDrag` / `applyBeamGripDrag` /
 * `applyFoundationGripDrag`) + τον ΙΔΙΟ geometry SSoT (`computeColumnGeometry` /
 * `computeBeamGeometry` / `computeFoundationGeometry`), ώστε preview === commit. Η
 * projection loop ζει σε ΕΝΑ σημείο — το κοινό {@link findBestCornerProjection}.
 *
 * Alt whole-entity move: η αρπαγμένη λαβή γίνεται απλό base point → το μέλος
 * ΜΕΤΑΤΟΠΙΖΕΤΑΙ (ποτέ resize/rotate), οπότε η projection τρέχει τον καθαρό
 * center-translate (`column-center` / `beam-midpoint` / `foundation-center`)
 * ανεξαρτήτως ποιας λαβής (rotation handle συμπεριλαμβανομένης).
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 *
 * @see ../walls/wall-face-corner-snap.ts — wall sibling (ADR-371)
 * @see ../../systems/cursor/corner-projection-snap.ts — shared core + priority resolver
 */

import type { Point2D } from '../../rendering/types/Types';
import { isColumnEntity, isBeamEntity, isFoundationEntity, type Entity } from '../../types/entities';
import type { ColumnGripKind, BeamGripKind, FoundationGripKind } from '../../hooks/useGripMovement';
import { applyColumnGripDrag } from '../columns/column-grips';
import { applyBeamGripDrag } from '../beams/beam-grips';
import { applyFoundationGripDrag } from '../foundations/foundation-grips';
import { computeColumnGeometry } from '../geometry/column-geometry';
import { computeBeamGeometry } from '../geometry/beam-geometry';
import { computeFoundationGeometry } from '../geometry/foundation-geometry';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import {
  findBestCornerProjection,
  type CornerProjectionResult,
  type FindSnapPoint,
} from '../../systems/cursor/corner-projection-snap';

/** Column grip kinds που μεταφράζουν/αλλάζουν το σώμα — corner projection ισχύει.
 *  Εξαιρεί `column-rotation` (γωνιακή, όχι corner-alignment) + free-corner vertex grips. */
const COLUMN_PROJECTION_GRIP_KINDS = new Set<ColumnGripKind>([
  'column-center',
  'column-width',
  'column-depth',
  'column-arm-length',
  'column-arm-width',
  'column-flange-length',
  'column-web-thickness',
  'column-i-flange-thickness',
  'column-i-web-thickness',
]);

/** True για column grip kinds όπου οι γωνίες πρέπει να προβληθούν & κουμπώσουν. */
export function isColumnCornerSnapGrip(kind: string | null | undefined): boolean {
  return kind != null && COLUMN_PROJECTION_GRIP_KINDS.has(kind as ColumnGripKind);
}

/** True για beam grip kinds που κινούν/αλλάζουν το σώμα (εξαιρεί rotation + bezier-curve). */
export function isBeamCornerSnapGrip(kind: string | null | undefined): boolean {
  return kind != null && kind !== 'beam-rotation' && kind !== 'beam-curve';
}

/** True για foundation grip kinds που κινούν/αλλάζουν το σώμα (εξαιρεί rotation). */
export function isFoundationCornerSnapGrip(kind: string | null | undefined): boolean {
  return kind != null && kind !== 'foundation-rotation';
}

/** Οι προτεινόμενες footprint-γωνίες της κολόνας (proposed params → geometry SSoT). */
function proposedColumnCorners(
  entity: Extract<Entity, { type: 'column' }>,
  gripKind: string | null | undefined,
  delta: Point2D,
  cursorPos: Point2D,
  altMove: boolean,
): readonly Point2D[] | null {
  if (!altMove && !isColumnCornerSnapGrip(gripKind)) return null;
  const kind: ColumnGripKind = altMove ? 'column-center' : (gripKind as ColumnGripKind);
  const proposed = applyColumnGripDrag(kind, { originalParams: entity.params, delta, currentPos: cursorPos });
  return projectVerticesTo2D(computeColumnGeometry(proposed).footprint.vertices);
}

/** Οι προτεινόμενες footprint-γωνίες της δοκού (proposed params → outline SSoT). */
function proposedBeamCorners(
  entity: Extract<Entity, { type: 'beam' }>,
  gripKind: string | null | undefined,
  delta: Point2D,
  cursorPos: Point2D,
  altMove: boolean,
): readonly Point2D[] | null {
  if (!altMove && !isBeamCornerSnapGrip(gripKind)) return null;
  const kind: BeamGripKind = altMove ? 'beam-midpoint' : (gripKind as BeamGripKind);
  const proposed = applyBeamGripDrag(kind, { originalParams: entity.params, delta, currentPos: cursorPos });
  return projectVerticesTo2D(computeBeamGeometry(proposed).outline.vertices);
}

/** Οι προτεινόμενες footprint-γωνίες του θεμελίου (proposed params → footprint SSoT). */
function proposedFoundationCorners(
  entity: Extract<Entity, { type: 'foundation' }>,
  gripKind: string | null | undefined,
  delta: Point2D,
  cursorPos: Point2D,
  altMove: boolean,
): readonly Point2D[] | null {
  if (!altMove && !isFoundationCornerSnapGrip(gripKind)) return null;
  const kind: FoundationGripKind = altMove ? 'foundation-center' : (gripKind as FoundationGripKind);
  const proposed = applyFoundationGripDrag(kind, { originalParams: entity.params, delta, currentPos: cursorPos });
  return projectVerticesTo2D(computeFoundationGeometry(proposed).footprint.vertices);
}

/**
 * Corner projection για ένα MOVE / RESIZE / Alt-move grip drag φέροντος μέλους
 * (κολόνα / δοκός / θεμέλιο). Παράγει τις προτεινόμενες γωνίες μέσω του type-specific
 * transform + geometry SSoT, μετά προβάλλει με τον κοινό {@link findBestCornerProjection}.
 * Επιστρέφει `null` όταν καμία γωνία δεν είναι κοντά σε στόχο (ή ο τύπος δεν προβάλλεται).
 *
 * @param entity        Το φέρον μέλος που σέρνεται.
 * @param gripKind      Η ενεργή λαβή (parametric kind).
 * @param dragAnchor    Αρχή drag (base point / resize handle).
 * @param cursorPos     Τρέχων world cursor (RAW — προ cursor-snap).
 * @param findSnapPoint Snap engine query.
 * @param altMove       Alt whole-entity move → whole-body translate ανεξαρτήτως λαβής.
 */
export function findMemberGripCornerSnap(
  entity: Readonly<Entity>,
  gripKind: string | null | undefined,
  dragAnchor: Point2D,
  cursorPos: Point2D,
  findSnapPoint: FindSnapPoint,
  altMove = false,
): CornerProjectionResult | null {
  const delta: Point2D = { x: cursorPos.x - dragAnchor.x, y: cursorPos.y - dragAnchor.y };

  let corners: readonly Point2D[] | null = null;
  if (isColumnEntity(entity)) {
    corners = proposedColumnCorners(entity, gripKind, delta, cursorPos, altMove);
  } else if (isBeamEntity(entity)) {
    corners = proposedBeamCorners(entity, gripKind, delta, cursorPos, altMove);
  } else if (isFoundationEntity(entity)) {
    corners = proposedFoundationCorners(entity, gripKind, delta, cursorPos, altMove);
  }

  if (!corners || corners.length < 3) return null;
  return findBestCornerProjection(corners, cursorPos, findSnapPoint, entity.id);
}
