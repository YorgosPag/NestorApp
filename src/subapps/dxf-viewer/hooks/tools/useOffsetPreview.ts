/**
 * USE OFFSET PREVIEW — ADR-510 Φ4d (ADR-040 micro-leaf)
 *
 * Live overlay during an OFFSET session. The «άμεσο» UX means the ghost is
 * recomputed every frame straight from the picked source + the 60fps cursor —
 * no pointer capture, no cached geometry. Subscribes to {@link OffsetToolStore}
 * (low-freq phase/source) via the shared `useCanvasGhostPreview` harness.
 *
 * Draws:
 *   - the dashed green parallel ghost at the cursor-driven (or typed) distance
 *   - a distance label near the cursor
 *   - a pickbox crosshair
 *
 * Ghost path reuses the SSoT `buildEntityPreviewPath` (systems/trim) — the same
 * entity→polyline tessellator the trim overlay uses. (Bulge polylines preview as
 * chords; the COMMITTED copy renders true arcs through the real renderer.)
 *
 * @module hooks/tools/useOffsetPreview
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { OffsetToolStore } from '../../systems/offset/OffsetToolStore';
import { offsetEntity } from '../../systems/offset/offset-entity-geometry';
import { resolveSignedOffset } from '../../systems/offset/offset-side';
import { buildEntityPreviewPath } from '../../systems/trim/trim-fence-hit-detector';
import { isCircleEntity, isPolylineEntity, isLWPolylineEntity } from '../../types/entities';
import type { Entity } from '../../types/entities';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
// ADR-055 — active-tool SSoT. OffsetToolStore phase is ALWAYS 'picking-source' (its
// INITIAL, no distinct 'idle'), so gating on phase alone left the #FFD24A pickbox
// painting in EVERY tool (canvas-drawn → visibly lags the cursor). Gate on the active
// tool too — same fix as fillet/chamfer. (Trim/extend are fine: they gate on `!== 'idle'`.)
import { useActiveTool } from '../../stores/ToolStateStore';

const GHOST_COLOR = '#22DD55';

export interface UseOffsetPreviewProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

function shouldClose(ghost: Entity): boolean {
  return isCircleEntity(ghost) || ((isPolylineEntity(ghost) || isLWPolylineEntity(ghost)) && ghost.closed === true);
}

export function useOffsetPreview(props: UseOffsetPreviewProps): void {
  const { transform, getCanvas, getViewportElement } = props;

  const phase = useSyncExternalStore(OffsetToolStore.subscribe, () => OffsetToolStore.getState().phase);
  const activeTool = useActiveTool();

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    const s = OffsetToolStore.getState();
    const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, t, viewport);

    if (s.phase === 'picking-side' && s.source && effectiveCursor) {
      const d = resolveSignedOffset(s.source, effectiveCursor, s.typedDistance);
      if (d !== null) {
        const ghost = offsetEntity(s.source, d, 'offset-ghost');
        if (ghost) {
          const path = buildEntityPreviewPath(ghost);
          if (path.length >= 2) {
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
            if (shouldClose(ghost)) ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }
        }
        // Distance label near the cursor (AutoCAD dynamic-input style).
        const c = toScreen(effectiveCursor);
        ctx.save();
        ctx.fillStyle = GHOST_COLOR;
        ctx.font = '12px sans-serif';
        ctx.fillText(Math.abs(d).toFixed(2), c.x + 12, c.y - 12);
        ctx.restore();
      }
    }

    // Pickbox crosshair
    if (!effectiveCursor) return;
    const c = toScreen(effectiveCursor);
    ctx.save();
    ctx.strokeStyle = '#FFD24A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(c.x - 6, c.y - 6, 12, 12);
    ctx.restore();
  }, []);

  useCanvasGhostPreview({
    isActive: activeTool === 'offset' && (phase === 'picking-source' || phase === 'picking-side'),
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}
