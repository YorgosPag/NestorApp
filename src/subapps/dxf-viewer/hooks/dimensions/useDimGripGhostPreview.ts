/**
 * ADR-362 Phase I (Round 22) — live dimension ghost during a grip drag.
 *
 * Mounted once in `PreviewCanvasMounts` (canvas-layer-stack-preview-mounts.tsx),
 * sibling of `useDimAssociationGhostPreview`. While the user drags a dimension
 * grip (ext-line origin / dim-line offset / text / linear rotation handle /
 * ordinate datum), this renders the dimension at its LIVE position on the shared
 * PreviewCanvas, frame-for-frame — so value + extension lines + text follow the
 * grip in real time instead of jumping only on release.
 *
 * SSoT reuse (zero new mechanism):
 *   - Live geometry → `applyDimensionGripDrag` — the SAME pure transform
 *     `commitDimensionGripDrag` runs on release → preview ≡ commit.
 *   - Render        → `renderPreviewDimension` (Phase C2) + `resolveDimStyle`.
 *   - RAF lifecycle → `useCanvasGhostPreview` harness (ADR-398 §4 / ADR-040).
 *
 * Why this dedicated mount (not the generic grip ghost): `applyEntityPreview` has
 * no `dimension` branch, so the generic `useGripGhostPreview` gets `transformed ===
 * entity` and paints nothing (its `if (transformed !== entity)` guard) — no
 * conflict, and the dimension renderer (not `drawGhostEntity`) owns dim painting.
 * The committed dim keeps drawing at its OLD position on the main canvas during the
 * drag (scene untouched until commit); this green ghost is the preview of the result.
 *
 * @see hooks/dimensions/useDimensionGrips.ts — applyDimensionGripDrag (shared with commit)
 * @see hooks/dimensions/useDimAssociationGhostPreview.ts — sibling (live follow during move)
 */

import React, { useCallback } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import type { DxfGripDragPreview } from '../grip-computation';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import { applyDimensionGripDrag, toDimensionEntity } from './useDimensionGrips';
import { renderPreviewDimension } from '../../canvas-v2/preview-canvas/preview-dimension-renderer';
import { resolveDimStyle } from '../../systems/dimensions/dim-style-resolver';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import { resolveSceneUnits } from '../../utils/scene-units';
import { useCanvasGhostPreview } from '../tools/useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
// ADR-562 Φ9.2 — paint the AutoAlign traces (resolved once by the mouse-move handler) on
// top of the live dim ghost, so geometry + traces share ONE resolve (WYSIWYG, ADR-357).
import { paintActionAlignmentTracking } from './dim-alignment-tracking';
import { getGripAlignmentTracking } from '../../systems/cursor/GripAlignmentTrackingStore';

export interface UseDimGripGhostPreviewProps {
  /** Live grip-drag snapshot (carries `dimGripKind` only when a dim grip is dragged). */
  readonly dragPreview: DxfGripDragPreview | null;
  readonly levelManager: LevelSceneReader;
  readonly transform: ViewTransform;
  readonly getCanvas: () => HTMLCanvasElement | null;
  readonly getViewportElement?: () => HTMLElement | null;
}

export function useDimGripGhostPreview(props: UseDimGripGhostPreviewProps): void {
  const { dragPreview, levelManager, transform, getCanvas, getViewportElement } = props;

  const isActive = dragPreview?.dimGripKind != null;

  const draw = useCallback(({ ctx, viewport, transform: t }: GhostDrawFrame) => {
    if (!dragPreview?.dimGripKind) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    const scene = levelManager.getLevelScene(levelId);
    if (!scene?.entities) return;

    // SceneModel stores DimensionEntity directly; the DxfDimension wrapper exists only
    // for the render pipeline — `toDimensionEntity` normalises both (shared SSoT with the
    // mouse handlers, so the ghost + the alignment resolve see the identical entity).
    const dimEntity = toDimensionEntity(scene.entities.find(e => e.id === dragPreview.entityId));
    if (!dimEntity) return;

    // gripPos = the grip world position at mouseDown (anchorPos) — matches the
    // commit's `grip.position` for the linear rotation handle (preview ≡ commit).
    const gripPos = dragPreview.anchorPos ?? dimEntity.defPoints[0] ?? { x: 0, y: 0 };
    const newDim = applyDimensionGripDrag(dragPreview.dimGripKind, dimEntity, dragPreview.delta, gripPos);

    const sceneUnits = resolveSceneUnits(scene);
    renderPreviewDimension({
      ctx,
      entity: newDim,
      style: resolveDimStyle(newDim, getDimStyleRegistry()),
      transform: t,
      viewport,
      sceneUnits,
    });

    // ADR-562 Φ9.2 — AutoAlign traces on top of the ghost. The mouse-move handler already
    // resolved them (aligning the same aligned point that fed `dragPreview.delta`) and
    // published the result → ONE resolve feeds both geometry and paint (WYSIWYG). Cleared
    // with the drag (GripDragStore.clearActiveDragGrip) so nothing lingers. toMm mirrors
    // the drawing-time tooltip unit (scene-units → mm).
    const dimTracking = getGripAlignmentTracking();
    if (dimTracking) {
      paintActionAlignmentTracking(ctx, dimTracking, t, viewport, sceneUnits);
    }
  }, [dragPreview, levelManager]);

  useCanvasGhostPreview({
    isActive,
    getCanvas,
    getViewportElement,
    transform,
    // Delta comes from dragPreview (not the cursor stream); layer on top of the
    // entity-ghost frame without wiping it. Committed dim stays on the main canvas.
    cursorMode: 'none',
    clearMode: 'skip-clear',
    draw,
  });
}

export interface DimGripGhostPreviewMountProps extends UseDimGripGhostPreviewProps {}

/** Zero-JSX mount (ADR-040 micro-leaf) — runs the live dim-grip ghost preview. */
export const DimGripGhostPreviewMount = React.memo(function DimGripGhostPreviewMount(
  props: DimGripGhostPreviewMountProps,
) {
  useDimGripGhostPreview(props);
  return null;
});
