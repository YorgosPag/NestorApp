/**
 * polar-disk-paint — ζωγραφίζει το **πολικό πλέγμα** του Polar Magnet (ADR-398 §3.13) στο
 * PreviewCanvas overlay: ομόκεντροι **δακτύλιοι** + ακτινικές **ακτίνες** + **κέντρο** (σταυρός).
 *
 * Full SSoT, μηδέν bespoke style:
 *   · γραμμές → `applyOverlayLineStyle` + `OVERLAY_LINE_COLORS.listeningDim` (το ΙΔΙΟ 0.5px dashed cyan
 *     με τα listening dims / tracking traces — μία οπτική γλώσσα)·
 *   · δακτύλιοι → `arcToPolyline` (κύκλος 0→360, ίδιο tessellation SSoT με §3.12)·
 *   · ακτίνες → `pointOnCircle` (γωνία→σημείο SSoT).
 *
 * Called AFTER `drawPreview` (overlays το ghost)· wiped στο επόμενο `drawPreview`/`clear`. Zero-React,
 * immediate paint (ADR-040) — δέχεται έτοιμο `ViewTransform` + viewport (ίδια σύμβαση με
 * `paintGhostFaceDimensions`). Screen-space μέσω `CoordinateTransforms.worldToScreen`.
 *
 * @see ../../bim/columns/polar-disk-snap.ts — `buildPolarDiskGrid` (παράγει το `PolarDiskGrid` meta)
 * @see ./ghost-face-dim-paint.ts — ίδια overlay σύμβαση (paint μετά το ghost)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.13
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PolarDiskGrid } from '../../bim/columns/polar-disk-snap';
import type { OverlayProjector } from './overlay-projector';
import { arcToPolyline } from '../../utils/geometry/GeometryUtils';
import { pointOnCircle } from '../../rendering/entities/shared/geometry-vector-utils';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';
import { applyOverlayLineStyle, OVERLAY_LINE_COLORS, strokeOverlaySegment } from './overlay-line-style';

/** Δείγματα ανά δακτύλιο (πυκνό αρκετά για ομαλό κύκλο σε κάθε zoom). */
const RING_SEGMENTS = 64;
/** Μισό μήκος (screen px) του σταυρού κέντρου. */
const CENTER_CROSS_PX = 6;

/** Ζωγράφισε έναν δακτύλιο (κύκλος) ως screen polyline. */
function strokeRing(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  toScreen: (p: Point2D) => Point2D,
): void {
  const curve = arcToPolyline({ center, radius, startAngle: 0, endAngle: 360 }, RING_SEGMENTS);
  if (curve.length < 2) return;
  ctx.beginPath();
  const s0 = toScreen(curve[0]);
  ctx.moveTo(s0.x, s0.y);
  for (let i = 1; i < curve.length; i++) {
    const s = toScreen(curve[i]);
    ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
}

/**
 * Ζωγράφισε το πολικό πλέγμα (δακτύλιοι + ακτίνες + κέντρο). `null`/άδειο grid → no-op.
 */
export function paintPolarDisk(
  ctx: CanvasRenderingContext2D,
  grid: PolarDiskGrid,
  project: OverlayProjector,
): void {
  if (grid.rings.length === 0) return;
  applyOverlayLineStyle(ctx, OVERLAY_LINE_COLORS.listeningDim);

  for (const ringR of grid.rings) strokeRing(ctx, grid.center, ringR, project);

  const sCenter = project(grid.center);
  for (const deg of grid.spokesDeg) {
    const tip = pointOnCircle(grid.center, grid.outerR, degToRad(deg));
    strokeOverlaySegment(ctx, sCenter, project(tip));
  }

  // Κέντρο = μικρός σταυρός σε σταθερό screen μέγεθος (zoom-invariant).
  strokeOverlaySegment(ctx, { x: sCenter.x - CENTER_CROSS_PX, y: sCenter.y }, { x: sCenter.x + CENTER_CROSS_PX, y: sCenter.y });
  strokeOverlaySegment(ctx, { x: sCenter.x, y: sCenter.y - CENTER_CROSS_PX }, { x: sCenter.x, y: sCenter.y + CENTER_CROSS_PX });
}
