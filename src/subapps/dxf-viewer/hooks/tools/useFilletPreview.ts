/**
 * USE FILLET PREVIEW — ADR-510 Φ4e (ADR-040 micro-leaf)
 *
 * Live overlay during a FILLET session. Recomputes the ghost every frame from the
 * picked first line + the hovered second line (or the hovered polyline) + the live
 * cursor — no pointer capture, no cached geometry. Subscribes to
 * {@link FilletToolStore} (low-freq phase/radius) via the shared
 * `useCanvasGhostPreview` harness.
 *
 * Draws:
 *   - the dashed green ghost of the tangent arc + trimmed lines (two-lines), or the
 *     rounded polyline (polyline mode)
 *   - a radius label near the cursor
 *   - a pickbox crosshair
 *
 * Ghost path reuses the SSoT `buildEntityPreviewPath` (systems/trim) — the same
 * entity→polyline tessellator the trim/offset overlays use.
 *
 * @module hooks/tools/useFilletPreview
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { FilletToolStore } from '../../systems/corner/FilletToolStore';
import {
  computeFilletTwoLines,
  computeFilletPolyline,
  computeFilletPolylineCorner,
} from '../../systems/corner/fillet-geometry';
import { resolveSharedPolylineCorner } from '../../systems/corner/corner-math';
import { computeFilletCurve, isFilletCurveEntity, type FilletCurveEntity } from '../../systems/corner/fillet-curve-geometry';
import { buildEntityPreviewPath } from '../../systems/trim/trim-fence-hit-detector';
import { tessellateArcDegrees } from '../../rendering/entities/shared/geometry-arc-utils';
import { distanceToEntity } from '../../utils/entity-distance';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import {
  isLineEntity,
  isArcEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  type Entity,
  type PolylineEntity,
  type LWPolylineEntity,
} from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
// ADR-055 — active-tool SSoT. The FilletToolStore phase is ALWAYS 'picking-first'
// (its INITIAL + reset() ready-state, no distinct 'idle'), so gating the preview on
// phase alone left the pickbox + «R …» label painting in EVERY tool. Gate on the
// active tool too — the pickbox/label is a FILLET-tool aid, shown only while it's active.
import { useActiveTool } from '../../stores/ToolStateStore';

const GHOST_COLOR = '#22DD55';

export interface UseFilletPreviewProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
  /** Live scene getter (event-time read, not captured) for the hover hit-test. */
  getScene: () => SceneModel | null;
}

function nearestFilletTarget(scene: SceneModel, cursor: Point2D, tol: number, excludeId: string): FilletCurveEntity | null {
  let best: { e: FilletCurveEntity; d: number } | null = null;
  for (const e of scene.entities) {
    if (e.id === excludeId || !isFilletCurveEntity(e)) continue;
    const d = distanceToEntity(cursor, e, tol);
    if (d === null || d > tol) continue;
    if (!best || d < best.d) best = { e, d };
  }
  return best?.e ?? null;
}

const GHOST_ARC_SEGMENTS = 48;

/** Ghost tessellation: DEGREES-correct for arcs (matches the committed render), SSoT path otherwise. */
function ghostPath(entity: Entity): ReadonlyArray<Point2D> {
  return isArcEntity(entity) ? tessellateArcDegrees(entity, GHOST_ARC_SEGMENTS) : buildEntityPreviewPath(entity);
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
  const path = ghostPath(entity);
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

export function useFilletPreview(props: UseFilletPreviewProps): void {
  const { transform, getCanvas, getViewportElement, getScene } = props;

  const phase = useSyncExternalStore(FilletToolStore.subscribe, () => FilletToolStore.getState().phase);
  const activeTool = useActiveTool();

  const draw = useCallback(
    ({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
      const s = FilletToolStore.getState();
      const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, t, viewport);
      const scene = getScene();

      if (effectiveCursor && scene) {
        const tol = TOLERANCE_CONFIG.SNAP_DEFAULT / (t.scale || 1);
        if (s.polylineMode) {
          const poly = nearestPolyline(scene, effectiveCursor, tol);
          if (poly) {
            const res = computeFilletPolyline(poly, s.radius);
            if (res) strokeGhost(ctx, res.entity, toScreen, res.entity.closed === true);
          }
        } else if (s.phase === 'picking-second' && s.first && (isPolylineEntity(s.first) || isLWPolylineEntity(s.first))) {
          // Same-polyline corner ghost: the cursor must hover the SAME polyline.
          const first = s.first;
          const d = distanceToEntity(effectiveCursor, first, tol);
          if (d !== null && d <= tol) {
            const cornerIndex = resolveSharedPolylineCorner(first, s.firstPick ?? effectiveCursor, effectiveCursor);
            if (cornerIndex !== null) {
              const res = computeFilletPolylineCorner(first, cornerIndex, s.radius);
              if (res) strokeGhost(ctx, res.entity, toScreen, res.entity.closed === true);
            }
          }
        } else if (s.phase === 'picking-second' && s.first) {
          const first = s.first;
          const hovered = nearestFilletTarget(scene, effectiveCursor, tol, first.id);
          if (hovered && isLineEntity(first) && isLineEntity(hovered)) {
            const res = computeFilletTwoLines(
              first, s.firstPick ?? effectiveCursor, hovered, effectiveCursor, s.radius, s.trim, 'fillet-ghost',
            );
            if (res) {
              if (res.arc) strokeGhost(ctx, res.arc, toScreen, false);
              for (const tr of res.trims) strokeGhost(ctx, tr.newGeom, toScreen, false);
            }
          } else if (hovered) {
            const res = computeFilletCurve(
              first, s.firstPick ?? effectiveCursor, hovered, effectiveCursor, s.radius, s.trim, 'fillet-ghost',
            );
            if (res) {
              strokeGhost(ctx, res.arc, toScreen, false);
              for (const tr of res.trims) strokeGhost(ctx, tr.newGeom, toScreen, false);
            }
          }
        }
        // Radius label near the cursor (AutoCAD dynamic-input style).
        const c = toScreen(effectiveCursor);
        ctx.save();
        ctx.fillStyle = GHOST_COLOR;
        ctx.font = '12px sans-serif';
        ctx.fillText(`R ${s.radius.toFixed(2)}`, c.x + 12, c.y - 12);
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
    isActive: activeTool === 'fillet' && (phase === 'picking-first' || phase === 'picking-second'),
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}
