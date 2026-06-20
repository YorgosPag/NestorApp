/**
 * USE MOVE PREVIEW — Ghost entity rendering during 2-click move operation
 *
 * ADR-049: Unified Move Tool (DXF + Overlays)
 * ADR-040: Preview Canvas Performance (imperative API, RAF, no React re-renders)
 *
 * Renders semi-transparent translated copies of selected entities on the
 * PreviewCanvas overlay. Also draws:
 *   - Base point crosshair marker (red)
 *   - Rubber band line: base point → cursor (dashed gold)
 *   - Displacement tooltip near cursor showing distance
 *
 * Ghost rendering itself is delegated to `rendering/ghost` (SSOT) — the same
 * primitives used by `useGripGhostPreview` so the two preview paths cannot
 * visually diverge.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): RAF
 * lifecycle + DPR-clear + canonical viewport/transform + clear-on-exit ζουν
 * πλέον ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic.
 *
 * @module hooks/tools/useMovePreview
 */

import { useCallback, useRef } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { AnySceneEntity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { MovePhase } from './useMoveTool';
import type { useLevels } from '../../systems/levels';
import type { Overlay } from '../../overlays/types';
import {
  applyEntityPreview,
  drawGhostEntity,
  makeTranslationPreview,
  GHOST_DEFAULTS,
} from '../../rendering/ghost';
import { getLayer } from '../../stores/LayerStore';
// ADR-363 — ORTHO (F8) axis-lock for the live MOVE ghost (no-op when OFF).
import { applyOrthoToDelta } from '../../bim/grips/grip-move-constraints';
// ADR-363 — live move-distance readout pill (base → destination), SSoT shared with the
// grip-drag preview + the 3D overlay (`drawDimPill` is the same Revit-grade dim pill).
import { drawDimPill } from '../../bim/labels/bim-dim-labels';
import { formatMoveDistance, moveReadoutMid, sceneDistanceToMeters } from '../../bim/labels/move-readout';
import { resolveSceneUnits } from '../../utils/scene-units';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

// ============================================================================
// TYPES
// ============================================================================

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'currentLevelId'
>;

export interface UseMovePreviewProps {
  phase: MovePhase;
  basePoint: Point2D | null;
  selectedEntityIds: string[];
  selectedOverlayIds?: string[];
  getOverlay?: (id: string) => Overlay | null;
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

const PREVIEW_PHASES: ReadonlySet<MovePhase> = new Set([
  'awaiting-base-point',
  'awaiting-destination',
]);

// ============================================================================
// HOOK
// ============================================================================

export function useMovePreview(props: UseMovePreviewProps): void {
  const {
    phase,
    basePoint,
    selectedEntityIds,
    selectedOverlayIds,
    getOverlay,
    levelManager,
    transform,
    getCanvas,
    getViewportElement,
  } = props;

  // O(1) entity lookup — map rebuilt only when entities array ref changes (not every RAF frame)
  const entityMapRef = useRef<Map<string, AnySceneEntity>>(new Map());
  const entityArrayRef = useRef<AnySceneEntity[] | undefined>(undefined);

  const getEntity = useCallback(
    (entityId: string): AnySceneEntity | null => {
      if (!levelManager.currentLevelId) return null;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene?.entities) return null;
      if (scene.entities !== entityArrayRef.current) {
        entityArrayRef.current = scene.entities;
        entityMapRef.current = new Map(scene.entities.map(e => [e.id, e]));
      }
      return entityMapRef.current.get(entityId) ?? null;
    },
    [levelManager],
  );

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!PREVIEW_PHASES.has(phase)) return;
    if (!basePoint) return;

    const pivotScreen = CoordinateTransforms.worldToScreen(basePoint, t, viewport);

    // Base point crosshair (red)
    const markerSize = 8;
    ctx.save();
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotScreen.x - markerSize, pivotScreen.y);
    ctx.lineTo(pivotScreen.x + markerSize, pivotScreen.y);
    ctx.moveTo(pivotScreen.x, pivotScreen.y - markerSize);
    ctx.lineTo(pivotScreen.x, pivotScreen.y + markerSize);
    ctx.stroke();
    ctx.restore();

    if (!effectiveCursor) return;

    // ORTHO (F8): lock the destination to the H/V axis from the base point so the
    // rubber band, ghost, and tooltip all match the committed move (useMoveTool).
    // No-op when ORTHO is OFF.
    const orthoDelta = applyOrthoToDelta({ x: effectiveCursor.x - basePoint.x, y: effectiveCursor.y - basePoint.y });
    const orthoDestination: Point2D = { x: basePoint.x + orthoDelta.x, y: basePoint.y + orthoDelta.y };
    const cursorScreen = CoordinateTransforms.worldToScreen(orthoDestination, t, viewport);

    // Rubber band (dashed gold)
    ctx.save();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pivotScreen.x, pivotScreen.y);
    ctx.lineTo(cursorScreen.x, cursorScreen.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Ghost + tooltip only during awaiting-destination
    if (phase !== 'awaiting-destination') return;

    // Same ORTHO-locked displacement the rubber band + commit use (WYSIWYG).
    const delta: Point2D = orthoDelta;

    // Live move-distance readout: a discreet Revit-grade pill at the rubber-band midpoint.
    const scene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
    const meters = sceneDistanceToMeters(Math.hypot(delta.x, delta.y), resolveSceneUnits(scene));
    const readoutMid = moveReadoutMid(pivotScreen, cursorScreen);
    drawDimPill(ctx, [formatMoveDistance(meters)], readoutMid.x, readoutMid.y);

    // Solid preview entities at destination — AutoCAD parity.
    if (Math.abs(delta.x) > 0.001 || Math.abs(delta.y) > 0.001) {
      ctx.save();
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = GHOST_DEFAULTS.lineWidth;

      for (const entityId of selectedEntityIds) {
        const entity = getEntity(entityId);
        if (!entity) continue;
        const preview = makeTranslationPreview(entityId, delta);
        const transformed = applyEntityPreview(entity as unknown as DxfEntityUnion, preview);
        const useLayerColor = !entity.color || entity.colorMode === 'ByLayer' || entity.colorMode === 'ByBlock';
        const color: string = useLayerColor
          ? (getLayer(entity.layerId)?.color ?? '#FFFFFF')
          : (entity.color ?? '#FFFFFF');
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        drawGhostEntity(ctx, transformed, t, viewport);
      }

      ctx.restore();

      // Solid overlay preview at destination (AutoCAD parity).
      if (selectedOverlayIds && selectedOverlayIds.length > 0 && getOverlay) {
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = GHOST_DEFAULTS.color;
        ctx.lineWidth = GHOST_DEFAULTS.lineWidth;
        for (const ovId of selectedOverlayIds) {
          const ov = getOverlay(ovId);
          if (!ov || ov.polygon.length < 2) continue;
          const pts = ov.polygon.map(([x, y]) =>
            CoordinateTransforms.worldToScreen({ x: x + delta.x, y: y + delta.y }, t, viewport)
          );
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }, [phase, basePoint, selectedEntityIds, selectedOverlayIds, getOverlay, getEntity, levelManager]);

  useCanvasGhostPreview({
    isActive: PREVIEW_PHASES.has(phase),
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}
