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
import type { AnySceneEntity } from '../../types/entities';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { ScaleToolStore } from '../../systems/scale/ScaleToolStore';
import { scalePoint } from '../../systems/scale/scale-entity-transform';
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

    // Ghost entities
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#00BFFF';
    ctx.lineWidth = 1.5;

    for (const entityId of s.selectedEntityIds) {
      const entity = getEntity(entityId);
      if (!entity) continue;
      drawGhostEntity(ctx, entity, s.basePoint, liveSx, liveSy, t, viewport);
    }

    ctx.restore();
  }, [getEntity]);

  useCanvasGhostPreview({
    isActive: phase !== 'idle',
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}

// ── Ghost entity drawing ──────────────────────────────────────────────────────

function drawGhostEntity(
  ctx: CanvasRenderingContext2D,
  entity: AnySceneEntity,
  base: Point2D,
  sx: number,
  sy: number,
  transform: ViewTransform,
  viewport: { width: number; height: number },
): void {
  const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, transform, viewport);
  const sp = (p: Point2D) => toScreen(scalePoint(p, base, sx, sy));

  switch (entity.type) {
    case 'line': {
      const s = sp(entity.start); const e = sp(entity.end);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      break;
    }
    case 'circle': {
      const c = sp(entity.center);
      const r = entity.radius * Math.abs(sx) * transform.scale;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'arc': {
      const c = sp(entity.center);
      const r = entity.radius * Math.abs(sx) * transform.scale;
      const startRad = (entity.startAngle * Math.PI) / 180;
      const endRad = (entity.endAngle * Math.PI) / 180;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, -startRad, -endRad, entity.counterclockwise ?? false); ctx.stroke();
      break;
    }
    case 'polyline':
    case 'lwpolyline': {
      if (entity.vertices.length < 2) break;
      ctx.beginPath();
      const first = sp(entity.vertices[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < entity.vertices.length; i++) {
        const p = sp(entity.vertices[i]);
        ctx.lineTo(p.x, p.y);
      }
      if (entity.closed) ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'text': {
      const pos = sp(entity.position);
      const fontSize = Math.max(8, (entity.height ?? entity.fontSize ?? 12) * Math.abs(sy) * transform.scale);
      ctx.save();
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = '#00BFFF';
      ctx.fillText(entity.text, pos.x, pos.y);
      ctx.restore();
      break;
    }
  }
}
