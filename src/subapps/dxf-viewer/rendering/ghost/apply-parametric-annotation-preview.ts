/**
 * SSOT — apply-parametric-annotation-preview
 *
 * Live-ghost transform for the params-driven annotation entities (graphic scale-bar, ADR-583 Φ2.4/Φ3;
 * opening-info-tag, ADR-612). Each is geometry-DERIVED, so a grip drag is a flat-field params patch
 * routed through the SAME `apply*GripDrag` SSoT the commit runs → preview ≡ commit by identity.
 * When the rotation handle is dragged about a PICKED centre (`rotatePivot`, set by the hot-grip
 * flow) the ghost ORBITS that centre exactly like the commit; `anchorPos` == the commit's
 * `BimRotateHotGripStore.anchor`.
 *
 * Extracted from `apply-entity-preview.ts` (SOS N.7.1 — keep that file under 500 lines), mirroring
 * the `apply-parametric-box-preview` split. Returns `null` when the preview targets neither
 * annotation kind, so the caller falls through to its other branches.
 */

import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { EntityPreviewTransform } from './entity-preview-types';
import { gripKindOf } from '../../hooks/grip-kinds';
import { applyScaleBarGripDrag } from '../../bim/scale-bar/scale-bar-grips';
import type { ScaleBarEntity } from '../../types/scale-bar';
import { applyOpeningInfoTagGripDrag } from '../../bim/opening-info-tag/opening-info-tag-grips';
import type { OpeningInfoTagEntity } from '../../types/opening-info-tag';

export function applyParametricAnnotationPreview(
  entity: DxfEntityUnion,
  preview: EntityPreviewTransform,
): DxfEntityUnion | null {
  const { delta, anchorPos, rotatePivot } = preview;

  // ── ADR-583 Φ2.4 / Φ3 — graphic scale-bar live ghost (move / rotation / length) ──
  const scaleBarGripKind = gripKindOf(preview, 'scale-bar');
  if (scaleBarGripKind && entity.type === 'scale-bar') {
    const rotate =
      scaleBarGripKind === 'scale-bar-rotation' && rotatePivot && anchorPos
        ? { pivot: rotatePivot, anchor: anchorPos }
        : undefined;
    const patch = applyScaleBarGripDrag(
      scaleBarGripKind,
      entity as unknown as ScaleBarEntity,
      anchorPos ?? (entity as unknown as ScaleBarEntity).position,
      delta,
      rotate,
    );
    return { ...(entity as object), ...patch } as unknown as DxfEntityUnion;
  }

  // ── ADR-612 — opening-info-tag live ghost (move / rotation / size) ──────────
  const openingInfoTagGripKind = gripKindOf(preview, 'opening-info-tag');
  if (openingInfoTagGripKind && entity.type === 'opening-info-tag') {
    const rotate =
      openingInfoTagGripKind === 'opening-info-tag-rotation' && rotatePivot && anchorPos
        ? { pivot: rotatePivot, anchor: anchorPos }
        : undefined;
    const patch = applyOpeningInfoTagGripDrag(
      openingInfoTagGripKind,
      entity as unknown as OpeningInfoTagEntity,
      anchorPos ?? (entity as unknown as OpeningInfoTagEntity).position,
      delta,
      rotate,
    );
    return { ...(entity as object), ...patch } as unknown as DxfEntityUnion;
  }

  return null;
}
