/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-552 BEFORE EDITING
 *
 * ADR-422 L3 — pipe-sizing badges (DN + ταχύτητα), ως analytical painter (ADR-552
 * dispatch). Πηγή λογικής: ο πρώην `PipeSizingOverlay.tsx` (verbatim paint).
 *
 * Όταν ON το toggle «Διαστασιολόγηση Σωληνώσεων»: στο μέσο κάθε σωλήνα θέρμανσης
 * badge με προτεινόμενη DN + ταχύτητα ροής. Derived (`usePipeSizing`), μηδέν
 * persistence. Gate: `showPipeSizing && 2d`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L3)
 */

import { useMemo } from 'react';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import { usePipeSizingViewStore } from '../../../state/pipe-sizing-view-store';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { usePipeSizing } from '../../../hooks/data/usePipeSizing';
import { isMepSegmentEntity } from '../../../types/entities';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import { pillPath, PILL_BG_COLOR, contrastTextColor } from '../../../rendering/utils/canvas-pill';
import type { ViewTransform, Viewport, Point2D } from '../../../rendering/types/Types';
import type { AnalyticalPainter } from './analytical-painter';

const DN_FONT = 'bold 12px sans-serif';
const FLOW_FONT = '10px sans-serif';
const LINE_HEIGHT_PX = 14;
const PILL_PAD_X = 6;
const PILL_PAD_Y = 4;
/** Pill φόντο όταν κανένας βαθμός DN δεν ικανοποιεί τα όρια (saturated). */
const SATURATED_BG_COLOR = '#b45309';

/** Μέσο (screen px) ενός σωλήνα από τα δύο άκρα του (world coords). */
function segmentMidScreen(
  start: { x: number; y: number },
  end: { x: number; y: number },
  transform: ViewTransform,
  viewport: Viewport,
): Point2D {
  const world = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return CoordinateTransforms.worldToScreen(world, transform, viewport);
}

/** Badge «DN… / …m/s» μέσα σε pill, κεντραρισμένο στο μέσο του σωλήνα. */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  centre: Point2D,
  dnLine: string,
  flowLine: string,
  saturated: boolean,
): void {
  ctx.font = DN_FONT;
  const dnW = ctx.measureText(dnLine).width;
  ctx.font = FLOW_FONT;
  const flowW = ctx.measureText(flowLine).width;

  const textW = Math.max(dnW, flowW);
  const boxW = textW + PILL_PAD_X * 2;
  const boxH = LINE_HEIGHT_PX * 2 + PILL_PAD_Y * 2;
  const x = centre.x - boxW / 2;
  const y = centre.y - boxH / 2;

  const bg = saturated ? SATURATED_BG_COLOR : PILL_BG_COLOR;
  pillPath(ctx, x, y, boxW, boxH, 4);
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.fillStyle = contrastTextColor(bg);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = DN_FONT;
  ctx.fillText(dnLine, centre.x, y + PILL_PAD_Y + LINE_HEIGHT_PX / 2);
  ctx.font = FLOW_FONT;
  ctx.fillText(flowLine, centre.x, y + PILL_PAD_Y + LINE_HEIGHT_PX + LINE_HEIGHT_PX / 2);
}

/** Pipe-sizing analytical painter (`null` όταν ανενεργό/κενό). */
export function usePipeSizingPainter(): AnalyticalPainter | null {
  // Leaf subscriptions (ADR-040): render mode + sizing-preview toggle.
  const mode = useViewMode3DStore((s) => s.mode);
  const showPipeSizing = usePipeSizingViewStore((s) => s.showPipeSizing);
  const active = showPipeSizing && mode === '2d';

  // Active-floor BIM scene — read DIRECTLY (no memo), mirror heat-load painter.
  const levelsCtx = useLevelsOptional();
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;
  const scene =
    active && currentLevelId && getLevelScene ? getLevelScene(currentLevelId) : null;

  const sizing = usePipeSizing(scene, active);

  return useMemo<AnalyticalPainter | null>(() => {
    if (!active || !scene || sizing.size === 0) return null;
    return (ctx, transform, viewport) => {
      ctx.save();
      ctx.setLineDash([]);
      for (const entity of scene.entities) {
        if (!isMepSegmentEntity(entity) || entity.params.domain !== 'pipe') continue;
        const result = sizing.get(entity.id);
        if (!result) continue;
        const centre = segmentMidScreen(entity.params.startPoint, entity.params.endPoint, transform, viewport);
        drawBadge(ctx, centre, `DN${result.dnMm}`, `${result.velocityMS.toFixed(2)} m/s`, result.saturated);
      }
      ctx.restore();
    };
  }, [active, scene, sizing]);
}
