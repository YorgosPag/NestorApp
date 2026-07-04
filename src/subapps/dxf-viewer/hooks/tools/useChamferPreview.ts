/**
 * USE CHAMFER PREVIEW — ADR-510 Φ4f (ADR-040 micro-leaf)
 *
 * Live overlay during a CHAMFER session. Recomputes the ghost every frame from the
 * picked first line + the hovered second line (or the hovered polyline) + the live
 * cursor. Subscribes to {@link ChamferToolStore} via the shared
 * `useCanvasGhostPreview` harness. Mirrors `useFilletPreview` (bevel line instead of
 * an arc). Ghost path reuses the SSoT `buildEntityPreviewPath`.
 *
 * @module hooks/tools/useChamferPreview
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { ChamferToolStore } from '../../systems/corner/ChamferToolStore';
import { computeChamferTwoLines, computeChamferPolyline, computeChamferPolylineCorner } from '../../systems/corner/chamfer-geometry';
import { resolveSharedPolylineCorner } from '../../systems/corner/corner-math';
import { buildEntityPreviewPath } from '../../systems/trim/trim-fence-hit-detector';
import { distanceToEntity } from '../../utils/entity-distance';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  type Entity,
  type LineEntity,
  type PolylineEntity,
  type LWPolylineEntity,
} from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
// ADR-055 — active-tool SSoT. ChamferToolStore phase is ALWAYS 'picking-first' (its
// INITIAL + reset() ready-state, no distinct 'idle'), so gating on phase alone left the
// pickbox + «d1×d2» label painting in EVERY tool. Gate on the active tool too.
import { useActiveTool } from '../../stores/ToolStateStore';

const GHOST_COLOR = '#22DD55';

export interface UseChamferPreviewProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
  getScene: () => SceneModel | null;
}

function nearestLine(scene: SceneModel, cursor: Point2D, tol: number, excludeId: string): LineEntity | null {
  let best: { e: LineEntity; d: number } | null = null;
  for (const e of scene.entities) {
    if (e.id === excludeId || !isLineEntity(e)) continue;
    const d = distanceToEntity(cursor, e, tol);
    if (d === null || d > tol) continue;
    if (!best || d < best.d) best = { e, d };
  }
  return best?.e ?? null;
}

function nearestPolyline(scene: SceneModel, cursor: Point2D, tol: number): PolylineEntity | LWPolylineEntity | null {
  let best: { e: PolylineEntity | LWPolylineEntity; d: number } | null = null;
  for (const e of scene.entities) {
    if (!isPolylineEntity(e) && !isLWPolylineEntity(e)) continue;
    const d = distanceToEntity(cursor, e, tol);
    if (d === null || d > tol) continue;
    if (!best || d < best.d) best = { e, d };
  }
  return best?.e ?? null;
}

function strokeGhost(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  toScreen: (p: Point2D) => Point2D,
  close: boolean,
): void {
  const path = buildEntityPreviewPath(entity);
  if (path.length < 2) return;
  ctx.save();
  ctx.strokeStyle = GHOST_COLOR;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  const first = toScreen(path[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < path.length; i++) {
    const p = toScreen(path[i]);
    ctx.lineTo(p.x, p.y);
  }
  if (close) ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function useChamferPreview(props: UseChamferPreviewProps): void {
  const { transform, getCanvas, getViewportElement, getScene } = props;

  const phase = useSyncExternalStore(ChamferToolStore.subscribe, () => ChamferToolStore.getState().phase);
  const activeTool = useActiveTool();

  const draw = useCallback(
    ({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
      const s = ChamferToolStore.getState();
      const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, t, viewport);
      const scene = getScene();

      if (effectiveCursor && scene) {
        const tol = TOLERANCE_CONFIG.SNAP_DEFAULT / (t.scale || 1);
        if (s.polylineMode) {
          const poly = nearestPolyline(scene, effectiveCursor, tol);
          if (poly) {
            const res = computeChamferPolyline(poly, s.d1, s.d2);
            if (res) strokeGhost(ctx, res.entity, toScreen, res.entity.closed === true);
          }
        } else if (s.phase === 'picking-second' && s.first && (isPolylineEntity(s.first) || isLWPolylineEntity(s.first))) {
          // Same-polyline corner ghost: the cursor must hover the SAME polyline.
          const first = s.first;
          const d = distanceToEntity(effectiveCursor, first, tol);
          if (d !== null && d <= tol) {
            const cornerIndex = resolveSharedPolylineCorner(first, s.firstPick ?? effectiveCursor, effectiveCursor);
            if (cornerIndex !== null) {
              const res = computeChamferPolylineCorner(first, cornerIndex, s.d1, s.d2);
              if (res) strokeGhost(ctx, res.entity, toScreen, res.entity.closed === true);
            }
          }
        } else if (s.phase === 'picking-second' && s.first) {
          const first = s.first;
          const hovered = nearestLine(scene, effectiveCursor, tol, first.id);
          if (hovered && isLineEntity(first)) {
            const res = computeChamferTwoLines(
              first, s.firstPick ?? effectiveCursor, hovered, effectiveCursor, s.d1, s.d2, s.angle, s.mode, s.trim, 'chamfer-ghost',
            );
            if (res) {
              strokeGhost(ctx, res.bevel, toScreen, false);
              for (const tr of res.trims) strokeGhost(ctx, tr.newGeom, toScreen, false);
            }
          }
        }
        // Distances label near the cursor.
        const c = toScreen(effectiveCursor);
        ctx.save();
        ctx.fillStyle = GHOST_COLOR;
        ctx.font = '12px sans-serif';
        const label = s.mode === 'angle' ? `${s.d1.toFixed(1)} ∠${s.angle.toFixed(0)}°` : `${s.d1.toFixed(1)}×${s.d2.toFixed(1)}`;
        ctx.fillText(label, c.x + 12, c.y - 12);
        ctx.restore();
      }

      // Pickbox crosshair
      if (!effectiveCursor) return;
      const c = toScreen(effectiveCursor);
      ctx.save();
      ctx.strokeStyle = '#FFD24A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c.x - 6, c.y - 6, 12, 12);
      ctx.restore();
    },
    [getScene],
  );

  useCanvasGhostPreview({
    isActive: activeTool === 'chamfer' && (phase === 'picking-first' || phase === 'picking-second'),
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}
