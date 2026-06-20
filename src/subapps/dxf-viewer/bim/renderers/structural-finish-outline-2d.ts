/**
 * ADR-449 — 2D σοβατισμένη όψη (finished outline): shared pure-ctx SSoT helper.
 *
 * ADR-505 — thin consumer: οι world λωρίδες σοβά (4 σημεία ανά όψη, mitered γωνίες)
 * παράγονται από το ΕΝΑ SSoT `collectFinishOutlinePlanPolylines` (κοινό με τον DXF
 * export collector — εκεί extrude-άρονται)· εδώ γίνεται μόνο το mapping world→screen +
 * ctx stroke. Χρώμα = SSoT plaster flat colour (ίδιο με το 3D).
 *
 * ΕΝΑ σημείο — το καλούν ΚΑΙ ο `ColumnRenderer` ΚΑΙ ο `BeamRenderer` (μηδέν
 * διπλασιασμός). Pure ctx, ZERO subscriptions (ADR-040 compliant).
 *
 * @see ../finishes/structural-finish-plan-geometry.ts — geometry SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { StructuralFinishFaces } from '../finishes/structural-finish-types';
import { collectFinishOutlinePlanPolylines } from '../finishes/structural-finish-plan-geometry';
import type { SceneUnits } from '../../utils/scene-units';

/** Line width (px) της σοβατισμένης όψης (λεπτή, δευτερεύουσα του πυρήνα). */
const FINISH_OUTLINE_LINE_WIDTH_PX = 0.75;

/**
 * Ζωγραφίζει τη σοβατισμένη όψη ενός δομικού στοιχείου (κολόνα/δοκάρι). No-op όταν δεν
 * υπάρχουν εκτεθειμένες παρειές. (`heightMm` αδιάφορο στο 2Δ — μόνο ο DXF το χρησιμοποιεί.)
 */
export function drawStructuralFinishOutline(
  ctx: CanvasRenderingContext2D,
  faces: StructuralFinishFaces | undefined,
  sceneUnits: SceneUnits,
  worldToScreen: (p: Point2D) => Point2D,
): void {
  const polylines = collectFinishOutlinePlanPolylines(faces, sceneUnits, 0);
  if (polylines.length === 0) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = FINISH_OUTLINE_LINE_WIDTH_PX;
  for (const pl of polylines) {
    const pts = pl.points.map(worldToScreen);
    if (pts.length < 2) continue;
    ctx.strokeStyle = pl.colorHex;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  ctx.restore();
}
