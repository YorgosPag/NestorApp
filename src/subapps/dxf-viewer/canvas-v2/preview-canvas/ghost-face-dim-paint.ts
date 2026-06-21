/**
 * ghost-face-dim-paint — paints the wall-ghost listening dimensions (ADR-508 §dim) on the
 * PreviewCanvas overlay by REUSING the ADR-362 SSoT `renderPreviewDimension`. Zero second
 * dimension-drawing path: each along-face distance becomes a transient `aligned`
 * DimensionEntity ([p1, p2, dimLineRef]) rendered through the same builder/arrowhead/text
 * pipeline as committed dims, styled with the default ISO-129 template.
 *
 * @see ../../bim/framing/ghost-face-dim-references.ts — produces the measured dims (pure)
 * @see ./preview-dimension-renderer.ts — the live 2D dimension SSoT (ADR-362 Phase C2)
 */

import type { AlignedDimensionEntity } from '../../types/dimension';
import type { ViewTransform } from '../../rendering/types/Types';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import { ISO_129_TEMPLATE } from '../../systems/dimensions/dim-style-templates';
import { renderPreviewDimension } from './preview-dimension-renderer';

/** Build a transient aligned dim entity for one along-face measurement. */
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
    userText: '<>', // measured value (the along-face distance), formatted by the dim text SSoT
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
  for (const d of meta.dims) {
    renderPreviewDimension({
      ctx,
      entity: toAlignedDim(d.kind, [d.p1, d.p2, d.dimLineRef]),
      style: ISO_129_TEMPLATE,
      transform,
      viewport,
      sceneUnits: meta.sceneUnits,
    });
  }
}
