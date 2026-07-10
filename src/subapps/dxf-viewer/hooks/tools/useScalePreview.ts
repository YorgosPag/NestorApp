/**
 * USE SCALE PREVIEW — ADR-348
 *
 * Renders semi-transparent ghost entities scaled around the base point. Thin
 * binding over the shared {@link useTransformGhostPreview} draw-skeleton (Cluster
 * #16 SSoT, ADR-625): the base-point crosshair, rubber-band and tooltip chrome
 * live in the primitive. Here we bind only the SCALE specifics — the live scale
 * factor (from cursor distance) and the per-entity `scaleEntity` copies rendered
 * through the REAL entity renderer (ADR-550, incl. circle → ellipse).
 *
 * @module hooks/tools/useScalePreview
 * @see hooks/tools/use-transform-ghost-preview — shared transform draw-skeleton (ADR-625)
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { AnySceneEntity, Entity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { ScaleToolStore, type ScaleToolState } from '../../systems/scale/ScaleToolStore';
// ADR-348 SSoT — the SAME per-entity scale the commit (`ScaleEntityCommand`) applies, so the
// WYSIWYG preview cannot diverge from the committed result (incl. circle → ellipse).
import { scaleEntity } from '../../systems/scale/scale-entity-transform';
// ADR-550 (WYSIWYG) — moving copies render through the REAL entity renderer (full fidelity).
import { drawRealEntityPreview } from '../../rendering/ghost/draw-real-entity-preview';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import { useTransformGhostPreview, type TransformGhostFrame } from './use-transform-ghost-preview';

export interface UseScalePreviewProps {
  levelManager: LevelSceneReader;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

/** Live uniform scale factor from cursor distance (SSoT — same value tooltip + copies use). */
function computeLiveScale(s: ScaleToolState, cursor: Point2D, basePoint: Point2D): number {
  if (s.subPhase !== 'direct') return s.currentSx;
  const dist = Math.hypot(cursor.x - basePoint.x, cursor.y - basePoint.y);
  return dist > 0.001 ? dist / 100 : 1;
}

export function useScalePreview(props: UseScalePreviewProps): void {
  const { levelManager, transform, getCanvas, getViewportElement } = props;

  const getEntity = useCallback((id: string): AnySceneEntity | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    return scene?.entities.find(e => e.id === id) ?? null;
  }, [levelManager]);

  const renderCopies = useCallback(
    ({ state: s, cursor, basePoint, transform: t, viewport, bimPreview, layers }: TransformGhostFrame<ScaleToolState>) => {
      const live = computeLiveScale(s, cursor, basePoint);
      for (const entityId of s.selectedEntityIds) {
        const entity = getEntity(entityId);
        if (!entity) continue;
        const scaled = {
          ...(entity as object),
          ...scaleEntity(entity as Entity, basePoint, live, live),
        } as unknown as DxfEntityUnion;
        drawRealEntityPreview(bimPreview, scaled, layers, t, viewport);
      }
    },
    [getEntity],
  );

  useTransformGhostPreview<ScaleToolState>({
    store: ScaleToolStore,
    levelManager,
    transform,
    getCanvas,
    getViewportElement,
    isActivePhase: (phase) => phase !== 'idle',
    isDrawPhase: (s) => s.phase === 'scale_input',
    getBasePoint: (s) => s.basePoint,
    buildTooltip: (s, cursor, basePoint) => `×${computeLiveScale(s, cursor, basePoint).toFixed(3)}`,
    renderCopies,
  });
}
