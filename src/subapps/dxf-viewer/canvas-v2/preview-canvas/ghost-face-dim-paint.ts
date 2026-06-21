/**
 * ghost-face-dim-paint — paints the wall-ghost listening dimensions (ADR-508 §dim) on the
 * PreviewCanvas overlay by REUSING the ADR-362 SSoT `renderPreviewDimension`. Zero second
 * dimension-drawing path: each along-face distance becomes a transient `aligned`
 * DimensionEntity ([p1, p2, dimLineRef]) rendered through the same builder/arrowhead/text
 * pipeline as committed dims, styled with the default ISO-129 template.
 *
 * Numbers are formatted via `formatLengthForDisplay` — the SAME display-unit SSoT as the
 * tracking/length tooltips — so they read in the user's active unit (e.g. "2.30 m"). The dim
 * line is hidden behind the number via DIMTFILL='backgroundColor' (mask = live canvas bg).
 *
 * @see ../../bim/framing/ghost-face-dim-references.ts — produces the measured dims (pure)
 * @see ./preview-dimension-renderer.ts — the live 2D dimension SSoT (ADR-362 Phase C2)
 * @see ../../config/display-length-format.ts — `formatLengthForDisplay` display-unit SSoT
 */

import type { AlignedDimensionEntity } from '../../types/dimension';
import type { ViewTransform } from '../../rendering/types/Types';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import { ISO_129_TEMPLATE } from '../../systems/dimensions/dim-style-templates';
import { mmToSceneUnits } from '../../utils/scene-units';
import { formatLengthForDisplay } from '../../config/display-length-format';
import { resolveDxfCanvasBackgroundHex } from '../../config/color-config';
import { renderPreviewDimension } from './preview-dimension-renderer';

/** Build a transient aligned dim entity for one along-face measurement. `label` overrides the
 *  measured text so the value shows in the active display unit (the on-screen SSoT). */
function toAlignedDim(
  kind: string,
  defPoints: AlignedDimensionEntity['defPoints'],
  label: string,
): AlignedDimensionEntity {
  return {
    id: `__ghost_face_dim_${kind}`,
    type: 'dimension',
    layerId: '',
    dimensionType: 'aligned',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    userText: label,
  };
}

/**
 * Paint every dim in `meta` onto `ctx`. Called AFTER the ghost preview so the listening
 * dimensions overlay it (same convention as `drawTrackingAlignment`); the next
 * `drawPreview`/`clear` wipes them.
 */
export function paintGhostFaceDimensions(
  ctx: CanvasRenderingContext2D,
  meta: GhostFaceDimensionsMeta,
  transform: ViewTransform,
  viewport: { readonly width: number; readonly height: number },
): void {
  // DIMTFILL='backgroundColor' → the dim line is masked behind the number (Revit temporary-dim
  // chip) instead of crossing it. Mask colour = live canvas background (SSoT).
  const style = { ...ISO_129_TEMPLATE, dimtfill: 'backgroundColor' as const };
  const canvasBackground = resolveDxfCanvasBackgroundHex();
  const mmPerScene = 1 / Math.max(mmToSceneUnits(meta.sceneUnits), 1e-9);
  for (const d of meta.dims) {
    // Distance via the `formatLengthForDisplay` SSoT, forced to METRES (architectural
    // convention — Giorgio: listening dims always in m, regardless of the status-bar unit).
    const label = formatLengthForDisplay(d.valueScene * mmPerScene, { unit: 'm' });
    renderPreviewDimension({
      ctx,
      entity: toAlignedDim(d.kind, [d.p1, d.p2, d.dimLineRef], label),
      style,
      transform,
      viewport,
      sceneUnits: meta.sceneUnits,
      canvasBackground,
      // ADR-508 §dim — ephemeral dims: screen-constant ~10px text at any zoom (4/scale lives
      // inside the renderer; see preview-dimension-renderer).
      opts: { textScreenScaled: true },
    });
  }
}
