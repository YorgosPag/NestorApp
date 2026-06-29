/**
 * USE SCALE PREVIEW — ADR-348
 *
 * Renders semi-transparent ghost entities scaled around the base point.
 * Live preview at 60fps via requestAnimationFrame — zero React re-renders.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): RAF
 * lifecycle + DPR-clear + canonical viewport/transform + clear-on-exit ζουν
 * πλέον ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic.
 *
 * ⚠️ Σημείωση: η `phase` subscription (useSyncExternalStore → ScaleToolStore)
 * παραμένει στο top του hook — χρησιμοποιείται ως isActive gate + redraw trigger
 * για το harness.
 *
 * @module hooks/tools/useScalePreview
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { AnySceneEntity, Entity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { ScaleToolStore } from '../../systems/scale/ScaleToolStore';
// ADR-348 SSoT — the SAME per-entity scale the commit (`ScaleEntityCommand`) applies, so the
// WYSIWYG preview cannot diverge from the committed result (incl. circle → ellipse).
import { scaleEntity } from '../../systems/scale/scale-entity-transform';
// ADR-550 (WYSIWYG) — moving copies render through the REAL entity renderer (full fidelity).
import { drawRealEntityPreview } from '../../rendering/ghost/draw-real-entity-preview';
import { useBimPreviewRenderer } from './useBimPreviewRenderer';
import { useLevelLayersById } from './useLevelLayersById';
import type { useLevels } from '../../systems/levels';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'currentLevelId'>;

export interface UseScalePreviewProps {
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useScalePreview(props: UseScalePreviewProps): void {
  const { levelManager, transform, getCanvas, getViewportElement } = props;

  // Reactive phase read — triggers harness re-schedule when phase changes.
  // ⚠️ ΚΡΑΤΕΙΤΑΙ εδώ: isActive gate υπολογίζεται από αυτή.
  const phase = useSyncExternalStore(ScaleToolStore.subscribe, () => ScaleToolStore.getState().phase);

  const getEntity = useCallback((id: string): AnySceneEntity | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    return scene?.entities.find(e => e.id === id) ?? null;
  }, [levelManager]);

  // ADR-550 — lazy real-entity renderer + level layer-table getter (shared SSoT hooks).
  const getBimPreview = useBimPreviewRenderer();
  const layersById = useLevelLayersById(levelManager);

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    const s = ScaleToolStore.getState();
    if (s.phase !== 'scale_input' || !s.basePoint || !effectiveCursor) return;

    const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, t, viewport);

    // Base point marker
    const basePt = toScreen(s.basePoint);
    ctx.save();
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(basePt.x - 8, basePt.y); ctx.lineTo(basePt.x + 8, basePt.y);
    ctx.moveTo(basePt.x, basePt.y - 8); ctx.lineTo(basePt.x, basePt.y + 8);
    ctx.stroke();
    ctx.restore();

    // Compute live scale factor from cursor distance
    const dx = effectiveCursor.x - s.basePoint.x;
    const dy = effectiveCursor.y - s.basePoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const liveSx = s.subPhase === 'direct' ? (dist > 0.001 ? dist / 100 : 1) : s.currentSx;
    const liveSy = liveSx;

    // Rubber-band line from base to cursor
    const cursorPt = toScreen(effectiveCursor);
    ctx.save();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(basePt.x, basePt.y);
    ctx.lineTo(cursorPt.x, cursorPt.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Scale factor tooltip
    ctx.save();
    ctx.font = '12px monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`×${liveSx.toFixed(3)}`, cursorPt.x + 12, cursorPt.y - 8);
    ctx.restore();

    // Real WYSIWYG copies (full fidelity) — originals dim to ghosts at their source.
    ctx.save();
    const bimPreview = getBimPreview(ctx);
    const layers = layersById();
    for (const entityId of s.selectedEntityIds) {
      const entity = getEntity(entityId);
      if (!entity) continue;
      const scaled = {
        ...(entity as object),
        ...scaleEntity(entity as Entity, s.basePoint, liveSx, liveSy),
      } as unknown as DxfEntityUnion;
      drawRealEntityPreview(bimPreview, scaled, layers, t, viewport);
    }
    ctx.restore();
  }, [getEntity, getBimPreview, layersById]);

  useCanvasGhostPreview({
    isActive: phase !== 'idle',
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}
