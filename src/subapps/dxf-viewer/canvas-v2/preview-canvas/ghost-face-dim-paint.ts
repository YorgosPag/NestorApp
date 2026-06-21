/**
 * ghost-face-dim-paint — paints the wall-ghost listening dimensions (ADR-508 §dim) on the
 * PreviewCanvas overlay. Fully SSoT-composed, zero bespoke drawing:
 *   - LINE + extension lines  → `renderPreviewDimension` (ADR-362) with `overlayLineStyle`
 *     (the shared 0.5px dashed [8,5] `overlay-line-style` SSoT). The dim's own text is
 *     suppressed (`userText: ''`).
 *   - NUMBER                  → `drawOverlayLabel` (`overlay-text-style` SSoT — same font/chip
 *     as the tracking + polar tooltips), value via `formatLengthForDisplay` (forced metres).
 *
 * So the listening dims share line-style, text-style AND number-format code with the alignment
 * traces / polar line — one visual language, one SSoT per concern.
 *
 * @see ../../bim/framing/ghost-face-dim-references.ts — produces the measured dims (pure)
 * @see ./preview-dimension-renderer.ts — dim line geometry SSoT (ADR-362)
 * @see ./overlay-line-style.ts · ./overlay-text-style.ts — shared overlay SSoTs
 */

import type { AlignedDimensionEntity } from '../../types/dimension';
import type { ViewTransform } from '../../rendering/types/Types';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import { ISO_129_TEMPLATE } from '../../systems/dimensions/dim-style-templates';
import { mmToSceneUnits } from '../../utils/scene-units';
import { formatLengthForDisplay } from '../../config/display-length-format';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { renderPreviewDimension } from './preview-dimension-renderer';
import { drawOverlayLabel } from './overlay-text-style';
import { OVERLAY_LINE_COLORS } from './overlay-line-style';

/** Extra screen-px the number sits BEYOND the dim line (so it never overlaps it — no bg chip). */
const LABEL_CLEARANCE_PX = 9;

/** Build a transient aligned dim entity for one along-face measurement. Text is suppressed
 *  (`userText: ''`) — the number is drawn separately via the overlay-text SSoT. */
function toAlignedDim(
  kind: string,
  defPoints: AlignedDimensionEntity['defPoints'],
): AlignedDimensionEntity {
  return {
    id: `__ghost_face_dim_${kind}`,
    type: 'dimension',
    layerId: '',
    dimensionType: 'aligned',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    userText: '',
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
  const textColor = OVERLAY_LINE_COLORS.listeningDim; // CYAN — distinct mechanism colour
  const mmPerScene = 1 / Math.max(mmToSceneUnits(meta.sceneUnits), 1e-9);
  for (const d of meta.dims) {
    // Dashed 0.5px CYAN line + extension lines (text suppressed) via the dim-geometry SSoT.
    renderPreviewDimension({
      ctx,
      entity: toAlignedDim(d.kind, [d.p1, d.p2, d.dimLineRef]),
      style: ISO_129_TEMPLATE,
      transform,
      viewport,
      opts: { overlayLineStyle: true, color: OVERLAY_LINE_COLORS.listeningDim },
    });
    // Number via the overlay-text SSoT, forced to METRES (architectural convention), placed a
    // few px BEYOND the dim line (along its outward offset) so it never crosses any line — no
    // background needed. Outward = (dimLineRef − face-midpoint), in screen space.
    const label = formatLengthForDisplay(d.valueScene * mmPerScene, { unit: 'm' });
    const sRef = CoordinateTransforms.worldToScreen(d.dimLineRef, transform, viewport);
    const sMid = CoordinateTransforms.worldToScreen(
      { x: (d.p1.x + d.p2.x) / 2, y: (d.p1.y + d.p2.y) / 2 }, transform, viewport,
    );
    const ox = sRef.x - sMid.x, oy = sRef.y - sMid.y;
    const olen = Math.hypot(ox, oy) || 1;
    drawOverlayLabel(
      ctx, label,
      sRef.x + (ox / olen) * LABEL_CLEARANCE_PX,
      sRef.y + (oy / olen) * LABEL_CLEARANCE_PX,
      { textColor, align: 'center' },
    );
  }
}
