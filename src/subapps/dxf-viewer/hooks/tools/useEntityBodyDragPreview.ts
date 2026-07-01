/**
 * USE ENTITY BODY-DRAG PREVIEW — ADR (Entity Body-Drag: move / Ctrl-copy)
 *
 * Live ghost overlay for the body-drag gesture (grab an entity's body and drag
 * to MOVE, or Ctrl+drag to COPY). Subscribes to {@link EntityBodyDragStore}
 * (LOW-freq — one arm/clear per drag) for activation, then reads the anchor +
 * entity ids from the store and the live cursor from the frame to draw
 * full-fidelity translated copies at the destination.
 *
 * Pattern: identical to {@link useStretchPreview} / {@link useMovePreview}
 * (ADR-040 micro-leaf — RAF-driven via `useCanvasGhostPreview`, zero React
 * re-renders on cursor move). The WYSIWYG copies render through the REAL entity
 * renderer (`drawRealEntityPreview`) — the same SSoT as the Move tool, so the
 * preview cannot visually diverge from the committed result.
 *
 * @module hooks/tools/useEntityBodyDragPreview
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { AnySceneEntity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { EntityBodyDragStore } from '../../systems/drag/EntityBodyDragStore';
import { applyEntityPreview, makeTranslationPreview } from '../../rendering/ghost';
import { drawRealEntityPreview } from '../../rendering/ghost/draw-real-entity-preview';
import { useBimPreviewRenderer } from './useBimPreviewRenderer';
import { useLevelLayersById } from './useLevelLayersById';
// ORTHO (F8) axis-lock — shared SSoT with the Move ghost (no-op when OFF).
import { applyOrthoToDelta } from '../../bim/grips/grip-move-constraints';
// Live distance readout pill — same Revit-grade pill as Move / grip drag.
import { drawDimPill } from '../../bim/labels/bim-dim-labels';
import { formatMoveDistance, moveReadoutMid, sceneDistanceToMeters } from '../../bim/labels/move-readout';
import { resolveSceneUnits } from '../../utils/scene-units';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
import type { useLevels } from '../../systems/levels';

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'currentLevelId'>;

export interface UseEntityBodyDragPreviewProps {
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEntityBodyDragPreview(props: UseEntityBodyDragPreviewProps): void {
  const { levelManager, transform, getCanvas, getViewportElement } = props;

  const active = useSyncExternalStore(
    EntityBodyDragStore.subscribe,
    () => EntityBodyDragStore.getActive(),
  );

  // O(1) entity lookup memoised on scene array identity (rebuilt only when scene swaps).
  const entityMapRef = useRef<Map<string, AnySceneEntity>>(new Map());
  const entityArrayRef = useRef<readonly AnySceneEntity[] | null>(null);

  const getEntity = useCallback((id: string): AnySceneEntity | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) return null;
    if (scene.entities !== entityArrayRef.current) {
      entityArrayRef.current = scene.entities;
      entityMapRef.current = new Map(scene.entities.map(e => [e.id, e]));
    }
    return entityMapRef.current.get(id) ?? null;
  }, [levelManager]);

  // ADR-550 — lazy real-entity renderer + level layer-table getter (shared SSoT hooks).
  const getBimPreview = useBimPreviewRenderer();
  const getLayersById = useLevelLayersById(levelManager);

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    const session = EntityBodyDragStore.getSession();
    if (!session || !effectiveCursor) return;
    const { anchor, entityIds, copy } = session;

    const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, t, viewport);

    // ORTHO (F8): lock the destination to the H/V axis from the anchor so the
    // rubber band, ghost, and tooltip all match the committed result. No-op when OFF.
    const delta = applyOrthoToDelta({ x: effectiveCursor.x - anchor.x, y: effectiveCursor.y - anchor.y });
    const destination: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
    const anchorPt = toScreen(anchor);
    const cursorPt = toScreen(destination);

    // Base point crosshair (red)
    ctx.save();
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(anchorPt.x - 8, anchorPt.y); ctx.lineTo(anchorPt.x + 8, anchorPt.y);
    ctx.moveTo(anchorPt.x, anchorPt.y - 8); ctx.lineTo(anchorPt.x, anchorPt.y + 8);
    ctx.stroke();
    ctx.restore();

    // Rubber band (dashed gold)
    ctx.save();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(anchorPt.x, anchorPt.y);
    ctx.lineTo(cursorPt.x, cursorPt.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (Math.abs(delta.x) < 0.001 && Math.abs(delta.y) < 0.001) return;

    // Live distance readout pill (anchor → destination).
    const scene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
    const meters = sceneDistanceToMeters(Math.hypot(delta.x, delta.y), resolveSceneUnits(scene));
    const readoutMid = moveReadoutMid(anchorPt, cursorPt);
    drawDimPill(ctx, [formatMoveDistance(meters)], readoutMid.x, readoutMid.y);

    // WYSIWYG real copies at the destination (full fidelity, byte-identical to commit).
    ctx.save();
    const bimPreview = getBimPreview(ctx);
    const layers = getLayersById();
    for (const id of entityIds) {
      const entity = getEntity(id);
      if (!entity) continue;
      const preview = makeTranslationPreview(id, delta);
      const transformed = applyEntityPreview(entity as unknown as DxfEntityUnion, preview);
      drawRealEntityPreview(bimPreview, transformed, layers, t, viewport);
    }
    ctx.restore();

    // Copy cue — small green «+» near the cursor (AutoCAD/Revit copy affordance).
    if (copy) {
      ctx.save();
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2;
      const cx = cursorPt.x + 14;
      const cy = cursorPt.y - 14;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
      ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
      ctx.stroke();
      ctx.restore();
    }
  }, [getEntity, getBimPreview, getLayersById, levelManager]);

  useCanvasGhostPreview({
    isActive: active,
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}
