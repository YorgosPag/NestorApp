/**
 * @module slab-preview-helpers
 * @description Pure helper for slab tool real-time preview rendering.
 * Mirror of `wall-preview-helpers.ts` (ADR-363 Phase 1C).
 *
 * Exported: generateSlabPreview()
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PolylineEntity } from '../../types/scene';
import type { ExtendedSceneEntity, ExtendedPolylineEntity, PreviewPoint } from './drawing-types';
import { LINEWEIGHT_SPECIAL } from '../../config/lineweight-iso-catalog';
import { UI_COLORS } from '../../config/color-config';
import { getDefaultLayerId } from '../../stores/LayerStore';


/**
 * Build a slab preview entity from `tempPoints` + cursor. State machine map:
 *   - [] (awaitingFirstVertex) → cursor start marker
 *   - [v1] → rubber-band line v1→cursor (open)
 *   - [v1, v2, …] → outline polygon […vertices, cursor] closed (closing line shown)
 *
 * Returns a green translucent polyline tracing the polygon being drawn.
 * The preview is WYSIWYG: same vertex order as the committed SlabEntity.
 */
export function generateSlabPreview(
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
): ExtendedSceneEntity | null {
  if (tempPoints.length === 0) {
    return {
      id: 'preview_slab_startmarker',
      type: 'point',
      position: cursorPoint,
      size: 6,
      visible: true,
      layerId: getDefaultLayerId(),
      preview: true,
      showPreviewGrips: true,
    } as PreviewPoint;
  }

  const vertices = [...tempPoints, cursorPoint];
  // Close the polygon when ≥2 committed vertices: shows the closing edge hint.
  const closed = tempPoints.length >= 2;

  const polyline: PolylineEntity = {
    id: 'preview_slab_polygon',
    type: 'polyline',
    vertices,
    closed,
    visible: true,
    layerId: getDefaultLayerId(),
    color: UI_COLORS.BRIGHT_GREEN,
    lineweight: LINEWEIGHT_SPECIAL.BYLAYER,
    opacity: 0.65,
    lineType: 'solid' as const,
  };
  return {
    ...polyline,
    preview: true,
    showEdgeDistances: true,
    showPreviewGrips: true,
  } as ExtendedPolylineEntity;
}
