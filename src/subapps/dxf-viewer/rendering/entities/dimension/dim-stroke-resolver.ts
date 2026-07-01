/**
 * ADR-562 Φ2 — Dimension per-part stroke resolver (canvas SSoT).
 *
 * ONE pure bridge from a `DimStyle` per-part lineweight + linetype pair to the
 * two canvas stroke properties (`ctx.lineWidth` + `ctx.setLineDash`). Both dim
 * renderers (main `DimensionRenderer` + `preview-dimension-renderer`) call this
 * so dim lines / extension lines resolve their weight & dash through EXACTLY the
 * same SSoT as ordinary DXF lines — no duplicated logic, WYSIWYG preview↔commit.
 *
 * Reuses (no re-implementation):
 *   - `lineweightToPx`   (config/lineweight-iso-catalog) — mm → px, zoom-INDEPENDENT
 *      AutoCAD LWT. Returns 0 for the -3/-2/-1 sentinels.
 *   - `resolveAnyDashMm` (config/linetype-aliases)       — linetype name → mm pattern
 *      via the ADR-510 Unified Linetype catalog (unknown/'ByLayer' → [] = solid).
 *   - `dashMmToScreenPx` (rendering/linetype-dash-resolver) — mm → px, zoom-aware × LTSCALE.
 *   - `getLinetypeScale` (stores/LinetypeScaleStore)     — global LTSCALE knob.
 */

import type { LineweightMm } from '../../../types/entities';
import { lineweightToPx } from '../../../config/lineweight-iso-catalog';
import { resolveAnyDashMm } from '../../../config/linetype-aliases';
import { dashMmToScreenPx } from '../../linetype-dash-resolver';
import { getLinetypeScale } from '../../../stores/LinetypeScaleStore';

export interface DimStrokeStyle {
  /** Canvas `ctx.lineWidth` in px. */
  readonly lineWidthPx: number;
  /** Canvas `ctx.setLineDash` array in px; `[]` for solid (Continuous/ByLayer). */
  readonly dashPx: number[];
}

/**
 * Baseline px width for the sentinel lineweights (-3 Default / -2 ByLayer /
 * -1 ByBlock). Preserves the pre-ADR-562 hardcoded 1px dim stroke, so every
 * built-in (all ByLayer) template renders byte-identically → zero regression.
 * Concrete layer/block lineweight inheritance for the ByLayer case is a later
 * phase (the dim renderer does not yet carry the host layer's LWT).
 */
export const DIM_SENTINEL_STROKE_PX = 1;

/**
 * Resolve one part's (lineweight, linetype) to canvas stroke props.
 *
 * @param lineweight          `DimStyle.dimlwd` / `dimlwe` (LineweightMm).
 * @param linetype            `DimStyle.dimltype` / `dimltex1|2` (linetype name).
 * @param worldToScreenScale  Live world→screen zoom (`transform.scale`) — dash only.
 */
export function resolveDimStroke(
  lineweight: LineweightMm,
  linetype: string,
  worldToScreenScale: number,
): DimStrokeStyle {
  const px = lineweightToPx(lineweight, 96); // 0 for the -3/-2/-1 sentinels
  const lineWidthPx = px > 0 ? px : DIM_SENTINEL_STROKE_PX;
  const dashPx = dashMmToScreenPx(
    resolveAnyDashMm(linetype),
    worldToScreenScale,
    getLinetypeScale(),
  );
  return { lineWidthPx, dashPx };
}
