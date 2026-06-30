/**
 * @module wall-covering-preview-helpers
 * @description Pure helper για το real-time preview του wall-covering tool (ADR-511).
 * Mirror του `slab-preview-helpers.ts`, αλλά αντί για polygon-από-κορυφές, υπολογίζει τη
 * **λωρίδα στην παρειά** ενός κλειδωμένου τοίχου από το draw-context store + τον cursor.
 *
 * Exported: generateWallCoveringPreview()
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PolylineEntity } from '../../types/scene';
import type { ExtendedSceneEntity, ExtendedPolylineEntity, PreviewPoint } from './drawing-types';
import { LINEWEIGHT_SPECIAL } from '../../config/lineweight-iso-catalog';
import { UI_COLORS } from '../../config/color-config';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { wallCoveringPreviewStore } from '../../bim/wall-coverings/wall-covering-preview-store';
import { computeWallCoveringStrip } from '../../bim/wall-coverings/wall-covering-strip-geometry';
import { alongMmOnWall } from '../../bim/wall-coverings/wall-covering-pick';


/**
 * Build a wall-covering preview entity από το draw-context + cursor:
 *   - no context (awaiting wall) → cursor start marker
 *   - context locked → λωρίδα από spanStart έως cursor-projected spanEnd (closed quad)
 */
export function generateWallCoveringPreview(cursorPoint: Point2D): ExtendedSceneEntity | null {
  const { context } = wallCoveringPreviewStore.get();
  if (!context) {
    return {
      id: 'preview_wall_covering_startmarker',
      type: 'point',
      position: cursorPoint,
      size: 6,
      visible: true,
      layerId: getDefaultLayerId(),
      preview: true,
      showPreviewGrips: true,
    } as PreviewPoint;
  }

  const spanEndMm = alongMmOnWall(context.host, cursorPoint, context.sceneUnits);
  if (spanEndMm === null) return null;

  const strip = computeWallCoveringStrip(context.host, {
    faceSide: context.faceSide,
    spanStartMm: context.spanStartMm,
    spanEndMm,
    layers: context.layers,
    sceneUnits: context.sceneUnits,
  });
  if (!strip) return null;

  const polyline: PolylineEntity = {
    id: 'preview_wall_covering_strip',
    type: 'polyline',
    vertices: [...strip.quad],
    closed: true,
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
    showPreviewGrips: false,
  } as ExtendedPolylineEntity;
}
