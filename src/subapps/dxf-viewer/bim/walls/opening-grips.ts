/**
 * ADR-363 Phase 2.5 — Opening parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors the
 * pattern of `bim/walls/wall-grips.ts` (ADR-363 Phase 1C) and exposes a single
 * grip kind described in ADR-363 §6 Phase 2.5:
 *
 *   - `opening-offset` → drag the opening along the host wall axis, clamped
 *     to `[frameWidth, hostLength - width - frameWidth]` so the cutout cannot
 *     overlap the wall endpoints (mirrors AutoCAD / Revit behaviour where an
 *     opening always retains a minimum jamb on each side).
 *
 * SSoT:
 *   - Geometry math via `computeOpeningGeometry()` (called by
 *     `UpdateOpeningParamsCommand` at commit time — this module returns ONLY
 *     new `OpeningParams`).
 *   - Grip wire-up via the unified grip system (`OpeningRenderer.getGrips`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4 §6 Phase 2.5
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, OpeningGripKind } from '../../hooks/useGripMovement';
import type { OpeningEntity, OpeningParams } from '../types/opening-types';
import { DEFAULT_FRAME_WIDTH_MM } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { projectPointToWallOffset } from '../geometry/opening-geometry';

// ─── Grip position computation (ADR-363 §6 Phase 2.5) ────────────────────────

/**
 * Compute the parametric grip positions for an `OpeningEntity`. Layout is
 * a single grip at the opening's world center (the value of
 * `geometry.position` — already on the host wall axis):
 *
 *   0 → opening-offset (drag along host wall axis)
 *
 * Returns an empty array when the geometry cache hasn't been populated yet
 * (e.g. opening just hydrated from Firestore before host wall arrived).
 */
export function getOpeningGrips(entity: Readonly<OpeningEntity>): GripInfo[] {
  if (!entity.geometry) return [];
  const center = entity.geometry.position;
  return [
    {
      entityId: entity.id,
      gripIndex: 0,
      type: 'center',
      position: { x: center.x, y: center.y },
      movesEntity: true,
      openingGripKind: 'opening-offset',
    },
  ];
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface OpeningGripDragInput {
  /** Original params at drag start (preserves width / kind / handing / etc.). */
  readonly originalParams: OpeningParams;
  /** Current world cursor position — projected onto host wall axis. */
  readonly currentPos: Point2D;
  /** Host wall — required for axis projection + length clamp. */
  readonly hostWall: WallEntity;
}

/**
 * Pure transform: opening grip kind + drag input → new `OpeningParams`.
 * Geometry is NOT recomputed here — the caller
 * (`UpdateOpeningParamsCommand.execute`) re-derives `geometry` via
 * `computeOpeningGeometry()` so the math SSoT stays in one place.
 *
 * Algorithm (drag-along-wall):
 *   1. project `currentPos` onto host wall axis → axis offset (mm from start)
 *   2. subtract `width/2` so the projection lands at the opening's left jamb
 *   3. clamp to `[frameWidth, hostLength - width - frameWidth]` — guarantees
 *      a minimum jamb on each side, refusing the move when the host wall is
 *      too short to fit the opening + jambs (caller keeps original params).
 */
export function applyOpeningGripDrag(
  gripKind: OpeningGripKind,
  input: Readonly<OpeningGripDragInput>,
): OpeningParams {
  if (gripKind !== 'opening-offset') return input.originalParams;
  const { originalParams, currentPos, hostWall } = input;

  // wall.geometry.length is in metres → mm to match params units.
  const hostLengthMm = hostWall.geometry.length * 1000;
  const frameWidth = originalParams.frameWidth ?? DEFAULT_FRAME_WIDTH_MM;
  const minOffset = frameWidth;
  const maxOffset = hostLengthMm - originalParams.width - frameWidth;

  // Refuse when the host can't fit the opening + both jambs (avoid a clamp
  // that would force overflow — keep original params instead).
  if (maxOffset < minOffset) return originalParams;

  const axisOffset = projectPointToWallOffset(currentPos, hostWall);
  const candidateLeftOffset = axisOffset - originalParams.width / 2;
  const clamped = Math.max(minOffset, Math.min(maxOffset, candidateLeftOffset));

  if (clamped === originalParams.offsetFromStart) return originalParams;
  return { ...originalParams, offsetFromStart: clamped };
}
