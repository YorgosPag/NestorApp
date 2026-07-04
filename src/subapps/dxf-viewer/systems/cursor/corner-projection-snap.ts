/**
 * Corner Projection Snap — shared SSoT core (ADR-371 wall + ADR-398 column …).
 *
 * One algorithm backs every "drag/draw an entity so one of ITS OWN corners snaps
 * onto a nearby target" behaviour:
 *
 *   1. the caller projects the entity's candidate corners to their proposed world
 *      positions (wall = 2 face corners; column = 4/N footprint corners; …);
 *   2. this core queries the snap engine at each corner, keeps the closest valid
 *      match (optionally excluding the dragged entity's own stale corners), and
 *      returns the cursor correction so that corner lands EXACTLY on the target.
 *
 * Both `wall-face-corner-snap.ts` (ADR-371) and `bim/columns/column-corner-snap.ts`
 * (ADR-398) consume this — the projection loop lives in ONE place. A new entity
 * opts in by computing its corners and calling `findBestCornerProjection`; it must
 * never re-implement the query/best/correction loop.
 *
 * Correction identity: `adjustedCursorPos = cursorPos + (target − corner)`. Since
 * every corner is a fixed offset from the cursor, translating the cursor by
 * `(target − corner)` rigidly moves that corner onto the target (whole-body move /
 * placement); resize callers feed the result through their grip-drag transform,
 * which consumes only the relevant local-axis component.
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ProSnapResult } from '../../snapping/extended-types';
import { isSnapMarkerVisible, toSnapIndicatorView } from '../../snapping/extended-types';

/** Snap-engine query signature (shared by all corner-projection callers). */
export type FindSnapPoint = (x: number, y: number) => ProSnapResult | null;

/**
 * Construction / line snaps that are NOT valid corner-projection targets. Corner
 * projection means «does MY corner land on a DISCRETE feature of a neighbour»
 * (γωνία/άκρο/μέσο/τομή/κέντρο). Perpendicular/tangent/nearest/extension/parallel/
 * ortho είναι ΓΡΑΜΜΙΚΕΣ construction έλξεις που υπάρχουν ΠΑΝΤΟΥ (κάθε ακμή τις παράγει)
 * και «πνίγουν» το διακριτό `bim_corner` με μια αδύναμη έλξη σε τυχαία κάθετο — η κολόνα
 * «κολλάει» σε perpendicular γραμμές αντί να κουμπώνει γωνία-σε-γωνία όπως ο τοίχος
 * (Giorgio 2026-07-05, runtime diagnostics). Ο cursorProbe (ρητή πρόθεση κάτω από το
 * σταυρόνημα) ΤΑ ΔΕΧΕΤΑΙ ακόμη — μόνο η geometric corner-projection τα απορρίπτει.
 */
const NON_CORNER_TARGET_MODES = new Set<string>([
  'perpendicular', 'tangent', 'nearest', 'near', 'extension', 'parallel', 'ortho',
]);

/** True όταν το snap mode είναι διακριτός στόχος ευθυγράμμισης γωνίας (όχι construction line). */
function isCornerAlignmentTarget(result: ProSnapResult): boolean {
  return !NON_CORNER_TARGET_MODES.has(String(result.activeMode ?? ''));
}

export interface CornerProjectionResult {
  /** Snap result at the matched target corner (indicator + label shown HERE). */
  readonly snapResult: ProSnapResult;
  /** Effective cursor so the matched corner aligns exactly with the target. */
  readonly adjustedCursorPos: Point2D;
}

/**
 * Query the snap engine at each candidate corner and keep the closest valid
 * match. Returns `null` when no corner is near a target.
 *
 * @param corners         Proposed world positions of the entity's own corners.
 * @param cursorPos       Current effective cursor (drag origin reference).
 * @param findSnapPoint   Snap engine query.
 * @param excludeEntityId Optional — skip matches on the dragged entity's own
 *                        stale corners still present in the spatial index.
 */
export function findBestCornerProjection(
  corners: readonly Point2D[],
  cursorPos: Point2D,
  findSnapPoint: FindSnapPoint,
  excludeEntityId?: string | null,
): CornerProjectionResult | null {
  let best: CornerProjectionResult | null = null;
  let bestDistance = Infinity;

  for (const corner of corners) {
    const result = findSnapPoint(corner.x, corner.y);
    if (!result?.found || !result.snappedPoint) continue;

    // ADR-363 Φ1G.5 — reject SILENT snaps (grid / guide). Corner projection must
    // magnet onto REAL structural geometry (BIM corners / faces / endpoints), never
    // the ubiquitous grid: a grid landing is invisible (AutoCAD silent) AND its dense
    // points sit near every corner, so it masks true corner-to-corner alignment with
    // an imperceptible pull and no marker. Reuse the SAME visibility SSoT the marker
    // overlay uses ⇒ the corner attracts exactly when a marker would show.
    if (!isSnapMarkerVisible(toSnapIndicatorView(result))) continue;

    // ADR-560 §grip-OSNAP — corner projection κουμπώνει ΜΟΝΟ σε διακριτούς στόχους (γωνία/άκρο/
    // μέσο/τομή/κέντρο), όχι σε γραμμικές construction έλξεις (perpendicular/extension/…) που
    // υπάρχουν παντού και πνίγουν το bim_corner (Giorgio runtime diagnostics 2026-07-05).
    if (!isCornerAlignmentTarget(result)) continue;

    const targetEntityId = result.entityId ?? result.snapPoint?.entityId;
    if (excludeEntityId && targetEntityId === excludeEntityId) continue;

    const distance = result.distance ?? result.snapPoint?.distance ?? 0;
    if (distance >= bestDistance) continue;

    bestDistance = distance;
    best = {
      snapResult: result,
      adjustedCursorPos: {
        x: cursorPos.x + (result.snappedPoint.x - corner.x),
        y: cursorPos.y + (result.snappedPoint.y - corner.y),
      },
    };
  }

  return best;
}

/** A snap chosen by {@link resolveProjectedSnap}: the indicator (`snapResult`) + the
 *  point the ghost lands on (`ghostPoint`, corner-corrected when a corner projected),
 *  plus whether the overlay actually paints a glyph (`visible` — grid/guide are silent). */
export interface ProjectedSnap {
  readonly snapResult: ProSnapResult;
  readonly ghostPoint: Point2D;
  readonly visible: boolean;
}

/** True when the overlay would paint a glyph for this result (found + real snappedPoint
 *  + non-silent mode). Mirrors the hide-rule in `SnapIndicatorOverlay` — the ONE SSoT. */
function isVisibleProjectionResult(r: ProSnapResult | null): boolean {
  if (!r?.found || !r.snappedPoint) return false;
  return isSnapMarkerVisible(toSnapIndicatorView(r));
}

/**
 * Revit-grade snap precedence shared by the column DRAW tool (`resolveColumnDrawSnap`)
 * AND the grip Alt-drag / body-drag path (`resolveGripDragSnap`) — the SINGLE priority
 * implementation, so draw · move-preview · commit can never diverge:
 *
 *   1. **Visible corner-projection** — a projected corner landed on a discrete target
 *      (γωνία/άκρο/τομή): keep the corner alignment (glyph on the target).
 *   2. **Visible cursor snap** — a BIM characteristic under the crosshair: the user's
 *      explicit intent (previously masked when a corner landed on a SILENT grid).
 *   3. **Silent fallback** — grid/guide alignment (corner over cursor). Returned with
 *      `visible:false` so a caller can accept it (draw placement) or reject it (grip →
 *      let AutoAlign take over instead of pulling to an invisible grid point).
 *
 * Pure. `cornerProjection` = the caller's own corner-projection (may be `null`);
 * `findSnapPoint` = the unified snap engine (cursor query).
 */
export function resolveProjectedSnap(
  cursorPos: Readonly<Point2D>,
  cornerProjection: CornerProjectionResult | null,
  findSnapPoint: FindSnapPoint,
): ProjectedSnap | null {
  if (cornerProjection && isVisibleProjectionResult(cornerProjection.snapResult)) {
    return { snapResult: cornerProjection.snapResult, ghostPoint: cornerProjection.adjustedCursorPos, visible: true };
  }
  const cursorSnap = findSnapPoint(cursorPos.x, cursorPos.y);
  if (isVisibleProjectionResult(cursorSnap)) {
    return { snapResult: cursorSnap!, ghostPoint: cursorSnap!.snappedPoint!, visible: true };
  }
  if (cornerProjection) {
    return { snapResult: cornerProjection.snapResult, ghostPoint: cornerProjection.adjustedCursorPos, visible: false };
  }
  if (cursorSnap?.found && cursorSnap.snappedPoint) {
    return { snapResult: cursorSnap, ghostPoint: cursorSnap.snappedPoint, visible: false };
  }
  return null;
}
