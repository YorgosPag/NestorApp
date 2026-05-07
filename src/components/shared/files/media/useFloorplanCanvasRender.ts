/**
 * =============================================================================
 * ENTERPRISE: Floorplan Canvas Render Hook
 * =============================================================================
 *
 * Renders DXF or PDF content + overlay polygons onto a canvas with shared
 * coordinate transform. Used by FloorplanGallery for both inline and
 * fullscreen-modal viewports.
 *
 * @module components/shared/files/media/useFloorplanCanvasRender
 * @enterprise SPEC-237D
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { PanOffset } from '@/hooks/useZoomPan';
import type { DxfSceneData } from '@/types/file-record';
import type { FloorOverlayItem } from '@/hooks/useFloorOverlays';
import type { DxfDrawingMode } from '@/components/shared/files/media/floorplan-gallery-config';
import { renderDxfToCanvas } from '@/components/shared/files/media/floorplan-dxf-renderer';
import { drawOverlayPolygons } from '@/components/shared/files/media/floorplan-overlay-system';
import { renderPdfWithOverlays } from '@/components/shared/files/media/floorplan-pdf-overlay-renderer';

interface SceneBounds {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

export interface FloorplanCanvasRenderParams {
  canvasRef: RefObject<HTMLCanvasElement>;
  enabled: boolean;
  isDxf: boolean;
  /** True for any raster background (PDF page-1 image OR raster image: PNG/JPEG/WEBP/TIFF). */
  isRaster: boolean;
  loadedScene: DxfSceneData | null;
  /** HTMLImageElement of the raster background (PDF page-1 OR raw image). */
  rasterImage: HTMLImageElement | null;
  /** Bounds of the raster background — width × height in image-pixel space (Y-UP overlay convention). */
  rasterBounds: { width: number; height: number } | null;
  currentBounds: SceneBounds | null;
  zoom: number;
  panOffset: PanOffset;
  drawingMode: DxfDrawingMode;
  overlays?: ReadonlyArray<FloorOverlayItem>;
  highlightedUnitId?: string | null;
  /** ms delay only on first render after `enabled` flips true (e.g., modal layout) */
  firstRenderDelay?: number;
}

export function useFloorplanCanvasRender(params: FloorplanCanvasRenderParams): void {
  const {
    canvasRef, enabled, isDxf, isRaster, loadedScene, rasterImage, rasterBounds,
    currentBounds, zoom, panOffset, drawingMode, overlays, highlightedUnitId,
    firstRenderDelay,
  } = params;

  const readyRef = useRef(false);
  useEffect(() => { if (!enabled) readyRef.current = false; }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const hasContent = (isDxf && loadedScene) || (isRaster && rasterImage && rasterBounds);
    if (!hasContent) return;

    const doRender = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (isDxf && loadedScene) {
        renderDxfToCanvas(canvas, loadedScene, zoom, panOffset, drawingMode);
        if (overlays?.length && currentBounds) {
          drawOverlayPolygons(canvas, overlays, currentBounds, zoom, panOffset, highlightedUnitId);
        }
      } else if (isRaster && rasterImage && rasterBounds) {
        // Raster (PDF page-1 or image) + overlays in one pass.
        // Zoom/pan applied via calcFit (mirrors DXF renderer pattern).
        renderPdfWithOverlays(
          canvas, rasterImage, rasterBounds, overlays ?? [], highlightedUnitId, zoom, panOffset,
        );
      }
      readyRef.current = true;
    };

    if (!readyRef.current && firstRenderDelay && firstRenderDelay > 0) {
      const id = setTimeout(doRender, firstRenderDelay);
      return () => clearTimeout(id);
    }
    doRender();
  }, [
    canvasRef, enabled, isDxf, loadedScene, isRaster, rasterImage, rasterBounds,
    currentBounds, zoom, panOffset, drawingMode, overlays, highlightedUnitId,
    firstRenderDelay,
  ]);
}
