/**
 * SSOT — apply-opening-preview
 *
 * The opening-entity drag-preview branches, extracted from `apply-entity-preview`
 * (SOS N.7.1 — keep the dispatcher under 500 lines). Two live ghosts, each routing
 * through the SAME `applyOpeningGripDrag` / `resolveOpeningAltMove` SSoT the commit
 * runs (preview ≡ commit):
 *   · ADR-615 — SELF-HOSTED (free-standing) opening: MOVE / two-dimension resize /
 *     drag-rotate against a synthetic self-host (`selfOpeningHost`).
 *   · ADR-363 Φ1G.5 Slice 2 — HOSTED opening Alt-move: slide along the wall or
 *     RE-HOST to another wall («Pick New Host»), recomputing the full door symbol.
 *
 * Returns `null` when the preview does not target an opening branch, so the caller
 * falls through to the classic translate path.
 *
 * @see rendering/ghost/apply-entity-preview — the consuming dispatcher
 * @see ADR-615 — free-standing self-hosted opening
 * @see ADR-363 — hosted-opening Alt-move / re-host
 */

import type { Point2D } from '../types/Types';
import { translatePoint } from '../entities/shared/geometry-vector-utils';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { gripKindOf } from '../../hooks/grip-kinds';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { isSelfHostedOpening } from '../../bim/types/opening-types';
import { resolveOpeningAltMove, openingRehostToleranceWorld, applyOpeningGripDrag } from '../../bim/walls/opening-grips';
import { computeOpeningGeometry } from '../../bim/geometry/opening-geometry';
// ADR-615 — self-hosted opening live ghost synthesizes its host from params.
import { selfOpeningHost } from '../../bim/geometry/opening-host';
import type { EntityPreviewTransform, ApplyEntityPreviewContext } from './entity-preview-types';
import { applyClassicEntityPreview } from './apply-entity-preview-helpers';

/**
 * Apply the opening-specific drag-preview transform. Returns a cloned entity with new
 * geometry, the original entity unchanged (no-op grip), or `null` when the preview does
 * not hit an opening branch (caller continues to the classic path). Pure.
 */
export function applyOpeningPreview(
  entity: DxfEntityUnion,
  preview: EntityPreviewTransform,
  ctx: ApplyEntityPreviewContext | undefined,
): DxfEntityUnion | null {
  if (entity.type !== 'opening') return null;
  const { delta, gripIndex, movesEntity, edgeVertexIndices, anchorPos } = preview;
  const opening = entity as unknown as OpeningEntity;

  // ── ADR-615 — SELF-HOSTED (free-standing) opening live ghost (preview ≡ commit) ──
  // A free-standing opening has NO wall to slide along: MOVE = free 2D translate,
  // CORNER = two-dimension resize (μήκος + πλάτος), ROTATION = real drag-rotate —
  // ALL via the SAME `applyOpeningGripDrag` SSoT the commit runs. Recompute geometry
  // from the synthetic self-host (`selfOpeningHost` + `computeOpeningGeometry`) so
  // the ghost shows the moved/resized/rotated symbol LIVE (furniture parity, Revit-
  // grade). Placed BEFORE the wall-hosted branch below (which assumes a host wall).
  const openingGripKind = gripKindOf(preview, 'opening');
  if (openingGripKind) {
    if (isSelfHostedOpening(opening.params) && anchorPos) {
      const selfUnits = ctx?.sceneUnits ?? 'mm';
      const newParams = applyOpeningGripDrag(openingGripKind, {
        originalParams: opening.params,
        currentPos: translatePoint(anchorPos, delta),
        delta,
        sceneUnits: selfUnits,
      });
      if (newParams === opening.params) return entity;
      const geometry = computeOpeningGeometry(newParams, selfOpeningHost(newParams, selfUnits), selfUnits);
      return { ...(entity as object), params: newParams, kind: newParams.kind, geometry } as unknown as DxfEntityUnion;
    }
  }

  // ── ADR-363 Φ1G.5 Slice 2 — hosted-opening Alt-move ghost (slide / re-host) ──
  // A hosted opening slides along its wall — or RE-HOSTS to another wall (Revit
  // «Pick New Host»). With the scene `walls` (ctx) + the grabbed base point
  // (`anchorPos`), resolve the move through the SAME SSoT as the commit
  // (`resolveOpeningAltMove`) and recompute the FULL geometry against the resolved
  // host (`computeOpeningGeometry`) — so the ghost shows the door symbol (swing
  // arc + leaf) on the new wall, auto-rotated + auto-thickness, matching the commit.
  if (movesEntity) {
    const walls = ctx?.walls;
    if (walls && walls.length > 0 && anchorPos) {
      const currentHost = walls.find((w) => w.id === opening.params.wallId);
      if (currentHost) {
        const resolved = resolveOpeningAltMove({
          originalParams: opening.params,
          basePoint: anchorPos,
          currentPos: translatePoint(anchorPos, delta),
          currentHost,
          candidateWalls: walls,
          rehostToleranceWorld: openingRehostToleranceWorld(currentHost),
        });
        if (!resolved) return entity;
        const geometry = computeOpeningGeometry(
          resolved.params,
          resolved.host,
          resolved.host.params.sceneUnits ?? 'mm',
        );
        return { ...(entity as object), params: resolved.params, geometry } as unknown as DxfEntityUnion;
      }
    }
    // Fallback (no scene walls supplied): outline-only slide constrained to the
    // opening's own axis (geometry.rotation, radians) so the ghost never flies
    // off the wall even without a host-wall lookup.
    const rot = opening.geometry?.rotation;
    if (rot === undefined) return entity;
    const axis: Point2D = { x: Math.cos(rot), y: Math.sin(rot) };
    const along = delta.x * axis.x + delta.y * axis.y;
    const slideVec: Point2D = { x: axis.x * along, y: axis.y * along };
    return applyClassicEntityPreview(entity, slideVec, gripIndex, true, edgeVertexIndices);
  }

  return null;
}
