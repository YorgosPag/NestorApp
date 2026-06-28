/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-552 BEFORE EDITING
 *
 * ADR-422 L1 — analytical heat-load heat-map + Φ labels, ως analytical painter
 * (ADR-552 dispatch). Πηγή λογικής: ο πρώην `HeatLoadOverlay.tsx` (verbatim paint).
 *
 * Όταν ON το toggle «Θερμικό Φορτίο»: κάθε θερμικός χώρος του ενεργού ορόφου με
 * heat-map fill (ψυχρό→θερμό ανά W/m²) + ετικέτα «Φ … W» / «… W/m²» στο κέντρο.
 * Derived από τον engine (ADR-422), μηδέν persistence. Gate: `showHeatLoad && 2d`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1)
 */

import { useMemo } from 'react';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { useSpaceHeatLoads } from '../../../hooks/data/useSpaceHeatLoads';
import { heatLoadFillColor } from '../../../bim/thermal/heat-load/heat-load-color';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import { pillPath, PILL_BG_COLOR, contrastTextColor } from '../../../rendering/utils/canvas-pill';
import type { ViewTransform, Viewport, Point2D } from '../../../rendering/types/Types';
import type { AnalyticalPainter } from './analytical-painter';

const VALUE_FONT = 'bold 12px sans-serif';
const SPECIFIC_FONT = '10px sans-serif';
const LINE_HEIGHT_PX = 14;
const PILL_PAD_X = 6;
const PILL_PAD_Y = 4;

/** Centroid (screen px) του bbox ενός χώρου. */
function spaceCentreScreen(
  bbox: { min: Point2D; max: Point2D },
  transform: ViewTransform,
  viewport: Viewport,
): Point2D {
  const world = { x: (bbox.min.x + bbox.max.x) / 2, y: (bbox.min.y + bbox.max.y) / 2 };
  return CoordinateTransforms.worldToScreen(world, transform, viewport);
}

/** Heat-map fill κάθε χώρου (κλειστό polygon footprint σε screen coords). */
function fillSpace(
  ctx: CanvasRenderingContext2D,
  vertices: ReadonlyArray<Point2D>,
  color: string,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  if (vertices.length < 3) return;
  ctx.beginPath();
  const first = CoordinateTransforms.worldToScreen(vertices[0], transform, viewport);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < vertices.length; i++) {
    const s = CoordinateTransforms.worldToScreen(vertices[i], transform, viewport);
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Ετικέτα «Φ … W» + «… W/m²» μέσα σε pill badge, κεντραρισμένη στο centroid. */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  centre: Point2D,
  totalW: number,
  specificWperM2: number,
): void {
  const valueLine = `Φ ${Math.round(totalW).toLocaleString('el-GR')} W`;
  const specificLine = `${Math.round(specificWperM2).toLocaleString('el-GR')} W/m²`;

  ctx.font = VALUE_FONT;
  const valueW = ctx.measureText(valueLine).width;
  ctx.font = SPECIFIC_FONT;
  const specificW = ctx.measureText(specificLine).width;

  const textW = Math.max(valueW, specificW);
  const boxW = textW + PILL_PAD_X * 2;
  const boxH = LINE_HEIGHT_PX * 2 + PILL_PAD_Y * 2;
  const x = centre.x - boxW / 2;
  const y = centre.y - boxH / 2;

  pillPath(ctx, x, y, boxW, boxH, 4);
  ctx.fillStyle = PILL_BG_COLOR;
  ctx.fill();

  const textColor = contrastTextColor(PILL_BG_COLOR);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;
  ctx.font = VALUE_FONT;
  ctx.fillText(valueLine, centre.x, y + PILL_PAD_Y + LINE_HEIGHT_PX / 2);
  ctx.font = SPECIFIC_FONT;
  ctx.fillText(specificLine, centre.x, y + PILL_PAD_Y + LINE_HEIGHT_PX + LINE_HEIGHT_PX / 2);
}

/** Heat-load analytical painter (`null` όταν ανενεργό/κενό). */
export function useHeatLoadPainter(): AnalyticalPainter | null {
  // Leaf subscriptions (ADR-040): render mode + analytical toggle.
  const mode = useViewMode3DStore((s) => s.mode);
  const showHeatLoad = useBimRenderSettingsStore((s) => s.showHeatLoad);
  const active = showHeatLoad && mode === '2d';

  // Active-floor BIM scene — read DIRECTLY (no memo) so a scene replacement
  // (setLevelScene after a Ti/geometry edit) is picked up.
  const levelsCtx = useLevelsOptional();
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;
  const scene =
    active && currentLevelId && getLevelScene ? getLevelScene(currentLevelId) : null;

  const data = useSpaceHeatLoads(scene, active);

  return useMemo<AnalyticalPainter | null>(() => {
    if (!active || !data || data.spaces.length === 0) return null;
    return (ctx, transform, viewport) => {
      ctx.save();
      ctx.setLineDash([]);
      for (const space of data.spaces) {
        const result = data.results.get(space.id);
        const bbox = space.geometry?.bbox;
        if (!result || !bbox) continue;
        const color = heatLoadFillColor(result.specificLoadWperM2, data.minWperM2, data.maxWperM2);
        fillSpace(ctx, space.params.footprint.vertices, color, transform, viewport);
        const centre = spaceCentreScreen(bbox, transform, viewport);
        drawLabel(ctx, centre, result.totalW, result.specificLoadWperM2);
      }
      ctx.restore();
    };
  }, [active, data]);
}
