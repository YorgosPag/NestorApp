/**
 * ADR-362 Phase J4 (gap real-time) — live associative-dimension ghost paint.
 *
 * Pure paint function used by the drag/grip preview hook to draw associated
 * dimensions at their LIVE positions, frame-for-frame, while the underlying
 * geometry is being dragged (move tool / grip stretch) — BEFORE the command
 * commits. The recompute reuses the SAME SSoT the command-time observer uses
 * (`applyAssociationUpdates` → `recomputeAssociatedDefPoint`), so the live
 * preview is exactly what the release will commit (preview ≡ commit).
 *
 * Render reuses the Phase C2 `renderPreviewDimension` SSoT (bright-green preview
 * styling), so the live ghost dim cannot visually diverge from any other dim
 * preview. No new geometry, no new renderer — only wiring of two existing SSoTs.
 *
 * No React, no canvas-mount, no store reads — the caller supplies the live
 * transformed entities (`movingEntities`), the scene dim list, the original
 * entity lookup, the style resolver, and the active scene units. This keeps it
 * unit-testable with a mock `CanvasRenderingContext2D` (mirrors the
 * `preview-dimension-renderer` tests).
 *
 * @see systems/dimensions/dim-association-service.ts — pure recompute (shared with the observer)
 * @see canvas-v2/preview-canvas/preview-dimension-renderer.ts — render SSoT
 * @see hooks/dimensions/useDimAssociationGhostPreview.ts — React mount point (RAF)
 */

import type { DimensionEntity, DimStyle } from '../../types/dimension';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { SceneUnits } from '../../utils/scene-units';
import { applyAssociationUpdates } from './dim-association-service';
import { renderPreviewDimension } from '../../canvas-v2/preview-canvas/preview-dimension-renderer';

export interface PaintAssociatedDimensionGhostsParams {
  readonly ctx: CanvasRenderingContext2D;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
  /** Live (drag-transformed) geometry by entity id — the source of "moving" hosts. */
  readonly movingEntities: ReadonlyMap<string, SceneEntity>;
  /** Current scene dimension entities (the caller pre-filters to dims with associations). */
  readonly dims: readonly DimensionEntity[];
  /** Resolve an UNMOVED scene entity by id (for hosts not being dragged + 2nd intersection host). */
  readonly getOriginalEntity: (id: string) => SceneEntity | undefined;
  /** Resolve the effective `DimStyle` for a dim (same registry path as PreviewRenderer). */
  readonly resolveStyle: (dim: DimensionEntity) => DimStyle;
  readonly sceneUnits: SceneUnits;
  /** Optional preview color override (default = bright-green preview token in the renderer). */
  readonly color?: string;
  /** Optional preview opacity override. */
  readonly opacity?: number;
}

/**
 * True when ANY of the dim's associations references a currently-moving entity
 * (primary `geometryId` OR the 2nd `intersection` host `geometryId2`).
 */
function dimReferencesMovingHost(
  dim: DimensionEntity,
  movingEntities: ReadonlyMap<string, SceneEntity>,
): boolean {
  if (!dim.associations?.length) return false;
  for (const a of dim.associations) {
    if (movingEntities.has(a.geometryId)) return true;
    if (a.geometryId2 && movingEntities.has(a.geometryId2)) return true;
  }
  return false;
}

/**
 * Paint every associated dimension that touches a moving host at its live
 * recomputed position. Returns the number of dims actually painted (for tests).
 */
export function paintAssociatedDimensionGhosts(
  params: PaintAssociatedDimensionGhostsParams,
): number {
  const { ctx, transform, viewport, movingEntities, dims, getOriginalEntity, resolveStyle, sceneUnits } = params;
  if (movingEntities.size === 0 || dims.length === 0) return 0;

  // Live host resolver: a dragged host returns its transformed geometry, every
  // other host (incl. the 2nd intersection host) returns its committed scene
  // geometry. Shared by every association on every affected dim this frame.
  const getLiveEntity = (id: string): SceneEntity | undefined =>
    movingEntities.get(id) ?? getOriginalEntity(id);

  let painted = 0;
  for (const dim of dims) {
    if (!dimReferencesMovingHost(dim, movingEntities)) continue;

    // Same recompute SSoT as the command-time observer → preview ≡ commit.
    const { updated } = applyAssociationUpdates(dim, getLiveEntity);

    renderPreviewDimension({
      ctx,
      entity: updated,
      style: resolveStyle(updated),
      transform,
      viewport,
      sceneUnits,
      opts: { color: params.color, opacity: params.opacity },
    });
    painted++;
  }
  return painted;
}
