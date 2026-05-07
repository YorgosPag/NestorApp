/**
 * =============================================================================
 * ENTERPRISE: FloorplanGallery — Raster + Overlay Renderer
 * =============================================================================
 *
 * Renders a raster background (PDF page-1 image OR raw raster image) plus
 * overlay polygons in a single pass on the supplied canvas. Polygon-draw,
 * color, highlight, and Y-flip math all delegate to the SSoT in
 * `overlay-polygon-renderer.ts`. This file is now a thin adapter that maps
 * the rectangular raster bounds `{width, height}` to the canonical
 * `SceneBounds {min:{0,0}, max:{w,h}}` and handles image + canvas-clear.
 *
 * Coordinate convention (Y-UP, CAD — matches DXF Viewer editor): polygon
 * vertices are stored in raster-pixel world space with Y=0 at bottom.
 *
 * @module components/shared/files/media/floorplan-pdf-overlay-renderer
 * @enterprise SPEC-237D + ADR-340 §3.6 (overlay rendering SSoT)
 */

import type { FloorOverlayItem } from '@/hooks/useFloorOverlays';
import type { PanOffset } from '@/hooks/useZoomPan';
import { isPointInPolygon } from '@core/polygon-system/utils/polygon-utils';
import type { UniversalPolygon } from '@core/polygon-system/types';
import {
  computeFitTransform,
  rectBoundsToScene,
  renderOverlayPolygons,
  screenToWorld,
  type OverlayLabel,
} from './overlay-polygon-renderer';

const ZERO_PAN: PanOffset = { x: 0, y: 0 };

interface PdfBounds {
  width: number;
  height: number;
}

/**
 * Hit-test overlays at a canvas-pixel point. Returns the first overlay
 * with a linked propertyId at that point, or null.
 */
export function hitTestPdfOverlays(
  canvasX: number,
  canvasY: number,
  canvasWidth: number,
  canvasHeight: number,
  bounds: PdfBounds,
  overlays: ReadonlyArray<FloorOverlayItem>,
  zoom: number = 1,
  panOffset: PanOffset = ZERO_PAN,
): FloorOverlayItem | null {
  const scene = rectBoundsToScene(bounds.width, bounds.height);
  const fit = computeFitTransform(canvasWidth, canvasHeight, scene, zoom, panOffset);
  const world = screenToWorld(canvasX, canvasY, scene, fit);
  for (const overlay of overlays) {
    if (overlay.polygon.length < 3) continue;
    const universal: UniversalPolygon = {
      id: overlay.id,
      type: 'simple',
      points: overlay.polygon,
      isClosed: true,
      style: { strokeColor: '', fillColor: '', strokeWidth: 0, fillOpacity: 0, strokeOpacity: 0 },
    };
    if (isPointInPolygon(world, universal)) return overlay;
  }
  return null;
}

/**
 * Render raster image + overlay polygons in one pass. Sizes the canvas to
 * match its container. Polygon rendering delegates to the SSoT in
 * `overlay-polygon-renderer.ts` — same math/colors/highlight as the DXF path.
 */
export function renderPdfWithOverlays(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  bounds: PdfBounds,
  overlays: ReadonlyArray<FloorOverlayItem>,
  highlightedUnitId?: string | null,
  zoom: number = 1,
  panOffset: PanOffset = ZERO_PAN,
  getLabel?: (overlay: FloorOverlayItem) => OverlayLabel | null | undefined,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const container = canvas.parentElement;
  if (container) {
    const rect = container.getBoundingClientRect();
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // eslint-disable-next-line design-system/no-hardcoded-colors
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (bounds.width <= 0 || bounds.height <= 0) return;

  const scene = rectBoundsToScene(bounds.width, bounds.height);
  const fit = computeFitTransform(canvas.width, canvas.height, scene, zoom, panOffset);

  // Draw raster image (Y-DOWN raster: top-left at world (0,0), bottom-right at (W,H))
  ctx.drawImage(image, fit.offsetX, fit.offsetY, bounds.width * fit.scale, bounds.height * fit.scale);

  renderOverlayPolygons(ctx, overlays, scene, fit, { highlightedUnitId, getLabel });
}
