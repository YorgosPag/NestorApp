/**
 * PREVIEW ENTITY DISPATCH — per-type rubber-band entity render routing.
 *
 * Extracted from `PreviewRenderer.render()` (file-size SRP split, same spirit as
 * the ADR-065 958→3 split). Pure dispatch: given a preview entity, routes to the
 * matching `preview-entity-renderers` function (line/circle/polyline/rectangle/
 * angle-measurement/point/arc) or the ADR-362 dimension SSoT renderer. No canvas
 * state setup or context reads — the caller owns those.
 *
 * @module canvas-v2/preview-canvas/preview-entity-dispatch
 * @see canvas-v2/preview-canvas/PreviewRenderer — the consuming class
 * @see ADR-362 — Enterprise Dimension System (dim preview)
 */

import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type {
  ExtendedSceneEntity, ExtendedLineEntity, ExtendedCircleEntity, ExtendedPolylineEntity, PreviewPoint, PreviewText,
} from '../../hooks/drawing/useUnifiedDrawing';
import type { AngleMeasurementEntity } from '../../types/scene';
import type { PreviewRenderOptions, ArcPreviewEntity, PreviewRenderHelpers } from './preview-renderer-types';
import {
  renderLine, renderCircle, renderPolyline, renderRectangle,
  renderAngleMeasurement, renderPoint, renderArc,
} from './preview-entity-renderers';
// ADR-508 §text-parity — annotation ghost-word painter (single-click text/mtext insertion indicator).
import { renderPreviewText } from './preview-text-paint';
import { renderPreviewDimension } from './preview-dimension-renderer';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import type { DimensionEntity } from '../../types/dimension';
import type { SceneUnits } from '../../utils/scene-units';

/**
 * Dispatch a single preview entity to its type-specific renderer. `renderOpts`
 * already has grips suppressed when colored grips take over; `sceneUnits` feeds
 * the dimension preview's paper-mm→world formula (ADR-362 R9).
 */
export function dispatchPreviewEntityRender(
  ctx: CanvasRenderingContext2D,
  entity: ExtendedSceneEntity,
  transform: ViewTransform,
  viewport: Viewport,
  renderOpts: Required<PreviewRenderOptions>,
  helpers: PreviewRenderHelpers,
  sceneUnits: SceneUnits,
): void {
  switch (entity.type) {
    case 'line': renderLine(ctx, entity as ExtendedLineEntity, transform, renderOpts, helpers); break;
    case 'circle': renderCircle(ctx, entity as ExtendedCircleEntity, transform, renderOpts, helpers); break;
    case 'polyline': renderPolyline(ctx, entity as ExtendedPolylineEntity, transform, renderOpts, helpers); break;
    case 'rectangle': renderRectangle(ctx, entity, transform, renderOpts, helpers); break;
    case 'angle-measurement': renderAngleMeasurement(ctx, entity as AngleMeasurementEntity, transform, renderOpts, helpers); break;
    case 'point': renderPoint(ctx, entity as PreviewPoint, transform, renderOpts, helpers); break;
    case 'arc': renderArc(ctx, entity as ArcPreviewEntity, transform, renderOpts, helpers); break;
    // ADR-508 §text-parity — annotation ghost-word (Κείμενο/Πολυγραμμικό Κείμενο) στη θέση εισαγωγής.
    case 'text': renderPreviewText(ctx, entity as PreviewText, transform, helpers); break;
    // ADR-362 Phase D1: route dim preview through the Phase C2 renderer.
    case 'dimension': {
      const dimEntity = entity as DimensionEntity;
      const registry = getDimStyleRegistry();
      const style = registry.getStyle(dimEntity.styleId) ?? registry.getActiveStyle();
      renderPreviewDimension({
        ctx,
        entity: dimEntity,
        style,
        transform,
        viewport,
        opts: { color: renderOpts.color, opacity: renderOpts.opacity },
        sceneUnits,
      });
      break;
    }
  }
}
