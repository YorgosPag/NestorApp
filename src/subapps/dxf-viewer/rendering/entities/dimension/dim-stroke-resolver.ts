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
 *   - `resolveLinetypePatternMm` (rendering/linetype-dash-resolver) — linetype name
 *      → mm pattern via the ADR-510 Unified catalog + runtime registry customs
 *      (unknown/'ByLayer' → [] = solid). ONE resolution shared with the thumbnail.
 *   - `dashMmToScreenPx` (rendering/linetype-dash-resolver) — mm → px, zoom-aware × LTSCALE × CELTSCALE.
 *   - `getLinetypeScale` (stores/LinetypeScaleStore)     — global LTSCALE knob.
 *
 * Per-dim-style density (DIMLTSCALE, `DimStyle.dimltscale`) rides the `celtscale`
 * slot of `dashMmToScreenPx` — exactly the AutoCAD per-object linetype-scale
 * model (Path A). Global LTSCALE × per-style DIMLTSCALE compose multiplicatively.
 */

import type { LineweightMm } from '../../../types/entities';
import { lineweightToPx } from '../../../config/lineweight-iso-catalog';
import { dashMmToScreenPx, resolveLinetypePatternMm } from '../../linetype-dash-resolver';
// ADR-510 Φ2H — effective LTSCALE = per-scene base × user knob (scene base set by DxfRenderer).
import { getEffectiveLinetypeScale } from '../../../stores/LinetypeScaleStore';

/** DIMLTSCALE default — no per-style density change (AutoCAD CELTSCALE convention). */
export const DEFAULT_DIM_LTSCALE = 1;

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
 * @param ltScale             `DimStyle.dimltscale` — per-style density multiplier
 *                            (AutoCAD CELTSCALE slot). Non-positive/absent → 1.
 */
export function resolveDimStroke(
  lineweight: LineweightMm,
  linetype: string,
  worldToScreenScale: number,
  ltScale: number = DEFAULT_DIM_LTSCALE,
): DimStrokeStyle {
  const px = lineweightToPx(lineweight, 96); // 0 for the -3/-2/-1 sentinels
  const lineWidthPx = px > 0 ? px : DIM_SENTINEL_STROKE_PX;
  const celtscale = Number.isFinite(ltScale) && ltScale > 0 ? ltScale : DEFAULT_DIM_LTSCALE;
  const dashPx = dashMmToScreenPx(
    resolveLinetypePatternMm(linetype),
    worldToScreenScale,
    getEffectiveLinetypeScale(),
    celtscale,
  );
  return { lineWidthPx, dashPx };
}
