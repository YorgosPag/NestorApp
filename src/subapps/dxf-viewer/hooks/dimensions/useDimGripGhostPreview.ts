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
import type { DimensionEntity } from '../../types/dimension';
import type { DxfDimension } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfGripDragPreview } from '../grip-computation';
import type { useLevels } from '../../systems/levels';
import { applyDimensionGripDrag } from './useDimensionGrips';
import { renderPreviewDimension } from '../../canvas-v2/preview-canvas/preview-dimension-renderer';
import { resolveDimStyle } from '../../systems/dimensions/dim-style-resolver';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import { resolveSceneUnits } from '../../utils/scene-units';
import { useCanvasGhostPreview } from '../tools/useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'currentLevelId'>;

export interface UseDimGripGhostPreviewProps {
  /** Live grip-drag snapshot (carries `dimGripKind` only when a dim grip is dragged). */
  readonly dragPreview: DxfGripDragPreview | null;
  readonly levelManager: LevelManagerLike;
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

    const raw = scene.entities.find(e => e.id === dragPreview.entityId);
    if (!raw || (raw as { type?: string }).type !== 'dimension') return;

    // SceneModel stores DimensionEntity directly; the DxfDimension wrapper exists
    // only for the render pipeline (mirror commitDimensionGripDrag's resolution).
    const wrapper = raw as unknown as DxfDimension;
    const dimEntity: DimensionEntity = wrapper.dimensionEntity ?? (raw as unknown as DimensionEntity);

    // gripPos = the grip world position at mouseDown (anchorPos) — matches the
    // commit's `grip.position` for the linear rotation handle (preview ≡ commit).
    const gripPos = dragPreview.anchorPos ?? dimEntity.defPoints[0] ?? { x: 0, y: 0 };
    const newDim = applyDimensionGripDrag(dragPreview.dimGripKind, dimEntity, dragPreview.delta, gripPos);

    renderPreviewDimension({
      ctx,
      entity: newDim,
      style: resolveDimStyle(newDim, getDimStyleRegistry()),
      transform: t,
      viewport,
      sceneUnits: resolveSceneUnits(scene),
    });
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
