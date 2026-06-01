/**
 * placement-snap.ts — OSNAP resolution for 3D BIM element placement.
 *
 * ADR-403 (3D BIM Element Placement) — Phase 2. When OSNAP is ON, a placement
 * click must "click" onto the nearest characteristic point (corner / endpoint /
 * midpoint / intersection) of an existing element, exactly like the 2D pipeline
 * (ADR-398 column corner snap). This is the placement equivalent of the gizmo's
 * `makeResizeSnapFn` (ADR-402 `bim3d-snap-bridge`): a SINGLE point snaps to the
 * nearest feature — but a brand-new element has no id to exclude.
 *
 * The reference pattern (`bim3d-snap-bridge.ts`) is ADR-402 territory and is NOT
 * imported here (territory isolation); the ~6-line wrap is reproduced against the
 * shared snap-engine SSoT (`getGlobalSnapEngine()`), which 2D + ADR-402 + this
 * module all read.
 *
 * Coordinates are DXF plan millimetres throughout — the snap engine's native
 * space (`worldToPlanMm`). Conversion to scene units happens in the caller via
 * `planMmToScenePoint`, never here (avoids the classic 1000× double-scale bug).
 */

import type { Point2D } from '../../rendering/types/Types';
import { getGlobalSnapEngine } from '../../snapping/global-snap-engine';

/** Snap-corrected placement point + the snap target (for the 3D marker), mm. */
export interface PlacementSnapResolution {
  /** Corrected placement point — where the element is placed, mm. */
  readonly snappedMm: Point2D;
  /** The snap target that was hit, mm — drawn as the 3D snap marker. */
  readonly markerMm: Point2D;
}

/**
 * The slice of `ProSnapEngineV2` placement needs — structurally typed so the
 * unit tests can inject a fake (mirrors the `SnapQueryEngine` pattern).
 */
export interface PlacementSnapEngine {
  findSnapPoint(
    cursorPoint: Point2D,
    excludeEntityId?: string,
  ): { found: boolean; snapPoint: { point: Point2D } | null };
  getSettings(): { enabled: boolean };
}

/**
 * Resolve the OSNAP correction for a placement cursor.
 *
 * @param planMm  cursor position in DXF plan millimetres (from `worldToPlanMm`).
 * @param engine  defaults to the shared snap-engine SSoT; injectable for tests.
 * @returns the snapped point + marker target, or `null` when OSNAP is off or no
 *          feature is within the engine's tolerance (caller keeps the raw point).
 *
 * No `excludeEntityId` is passed: the column being placed does not exist yet, so
 * there is nothing to exclude from the candidate set.
 */
export function resolvePlacementSnap(
  planMm: Readonly<Point2D>,
  engine: PlacementSnapEngine = getGlobalSnapEngine(),
): PlacementSnapResolution | null {
  if (!engine.getSettings().enabled) return null;
  const r = engine.findSnapPoint({ x: planMm.x, y: planMm.y });
  if (!r.found || !r.snapPoint) return null;
  return { snappedMm: r.snapPoint.point, markerMm: r.snapPoint.point };
}
