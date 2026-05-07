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
  isPdf: boolean;
  loadedScene: DxfSceneData | null;
  pdfImage: HTMLImageElement | null;
  pdfDimensions: { width: number; height: number } | null;
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
    canvasRef, enabled, isDxf, isPdf, loadedScene, pdfImage, pdfDimensions,
    currentBounds, zoom, panOffset, drawingMode, overlays, highlightedUnitId,
    firstRenderDelay,
  } = params;

  const readyRef = useRef(false);
  useEffect(() => { if (!enabled) readyRef.current = false; }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const hasContent = (isDxf && loadedScene) || (isPdf && pdfImage && pdfDimensions);
    if (!hasContent) return;

    const doRender = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (isDxf && loadedScene) {
        renderDxfToCanvas(canvas, loadedScene, zoom, panOffset, drawingMode);
        if (overlays?.length && currentBounds) {
          drawOverlayPolygons(canvas, overlays, currentBounds, zoom, panOffset, highlightedUnitId);
        }
      } else if (isPdf && pdfImage && pdfDimensions) {
        // PDF + overlays use the editor-exact transform in a single pass
        renderPdfWithOverlays(canvas, pdfImage, pdfDimensions, overlays ?? [], highlightedUnitId);
      }
      readyRef.current = true;
    };

    if (!readyRef.current && firstRenderDelay && firstRenderDelay > 0) {
      const id = setTimeout(doRender, firstRenderDelay);
      return () => clearTimeout(id);
    }
    doRender();
  }, [
    canvasRef, enabled, isDxf, loadedScene, isPdf, pdfImage, pdfDimensions,
    currentBounds, zoom, panOffset, drawingMode, overlays, highlightedUnitId,
    firstRenderDelay,
  ]);
}
