/**
 * Overlay renderer — public API barrel.
 *
 * Single import surface for FloorplanGallery, PDF renderer, DXF Viewer
 * subapp consumers, and the (Phase 9 STEP H) transient measure tool.
 * Multi-kind dispatch lives in `dispatch.ts`; legacy polygon helpers
 * (FloorOverlayItem-based) live in `legacy.ts`.
 *
 * @module components/shared/files/media/overlay-renderer
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

export {
  computeFitTransform,
  rectBoundsToScene,
  worldToScreen,
  screenToWorld,
} from './transform';

export { OVERLAY_FALLBACK, resolvePolygonColors, resolveAnnotationStroke } from './colors';

export { drawPolygon } from './polygon';
export { drawLine } from './line';
export { drawCircle } from './circle';
export { drawArc } from './arc';
export { drawDimension } from './dimension';
export { drawMeasurement } from './measurement';
export { drawText } from './text';
export { renderOverlayLabel, polygonScreenCentroid } from './label';

export { renderOverlay } from './dispatch';
export { renderOverlayPolygon, renderOverlayPolygons } from './legacy';

export {
  formatDistance,
  formatArea,
  formatAngle,
} from './format-utils';

export type {
  SceneBounds,
  FitTransform,
  OverlayLabel,
  OverlayRenderContext,
  FloorplanOverlay,
  OverlayGeometry,
  OverlayGeometryType,
  OverlayRole,
  OverlayStyle,
  Point2D,
} from './types';

export type { RenderOptions } from './legacy';
export type { ResolvedColors } from './colors';
