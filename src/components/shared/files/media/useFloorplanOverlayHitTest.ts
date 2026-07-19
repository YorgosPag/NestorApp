/**
 * ENTERPRISE: useFloorplanOverlayHitTest — canvas hover/click hit-testing for
 * the FloorplanGallery overlay layer (SPEC-237C).
 *
 * Extracted from FloorplanGallery (SRP + file-size SSoT): owns the local hover
 * state, the DXF-vs-raster hit resolution, the rAF-throttled mouse-move, the
 * click dispatch and the rAF cleanup — the component just wires the returned
 * handlers onto its inline canvas.
 *
 * @module components/shared/files/media/useFloorplanOverlayHitTest
 * @enterprise ADR-237 / SPEC-237C
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  screenToWorld,
  hitTestOverlays,
  type OverlayAABB,
  type SceneBounds,
} from '@/components/shared/files/media/floorplan-overlay-system';
import { hitTestPdfOverlays } from '@/components/shared/files/media/floorplan-pdf-overlay-renderer';
import type { FloorOverlayItem } from '@/hooks/useFloorOverlays';
import type { PanOffset } from '@/hooks/useZoomPan';

interface UseFloorplanOverlayHitTestParams {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlays?: ReadonlyArray<FloorOverlayItem>;
  isDxf: boolean;
  isRaster: boolean;
  currentBounds: SceneBounds | null;
  rasterBounds: { width: number; height: number } | null;
  overlayAABBs: OverlayAABB[];
  zoom: number;
  panOffset: PanOffset;
  onHoverOverlay?: (propertyId: string | null) => void;
  onClickOverlay?: (propertyId: string) => void;
}

interface UseFloorplanOverlayHitTestResult {
  hoveredOverlayUnitId: string | null;
  handleCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseLeave: () => void;
}

/** Canvas-relative pointer position in backing-store pixels (DPR-aware). SSoT for
 *  the hover + click overlay hit handlers (N.0.2 — no copy-pasted rect math). */
function canvasEventToScreen(
  canvas: HTMLCanvasElement,
  e: React.MouseEvent<HTMLCanvasElement>,
): { screenX: number; screenY: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    screenX: (e.clientX - rect.left) * (canvas.width / rect.width),
    screenY: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

export function useFloorplanOverlayHitTest({
  canvasRef,
  overlays,
  isDxf,
  isRaster,
  currentBounds,
  rasterBounds,
  overlayAABBs,
  zoom,
  panOffset,
  onHoverOverlay,
  onClickOverlay,
}: UseFloorplanOverlayHitTestParams): UseFloorplanOverlayHitTestResult {
  const [hoveredOverlayUnitId, setHoveredOverlayUnitId] = useState<string | null>(null);
  const rafRef = useRef<number>(0);

  const resolveHit = useCallback((screenX: number, screenY: number, canvas: HTMLCanvasElement) => {
    if (!overlays?.length) return null;
    if (isDxf && currentBounds) {
      const worldPt = screenToWorld(screenX, screenY, canvas, currentBounds, zoom, panOffset);
      return hitTestOverlays(worldPt, overlays, overlayAABBs);
    }
    if (isRaster && rasterBounds) {
      return hitTestPdfOverlays(
        screenX, screenY, canvas.width, canvas.height, rasterBounds, overlays, zoom, panOffset,
      );
    }
    return null;
  }, [isDxf, isRaster, currentBounds, rasterBounds, overlays, overlayAABBs, zoom, panOffset]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlays?.length || !canvasRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { screenX, screenY } = canvasEventToScreen(canvas, e);
      const hit = resolveHit(screenX, screenY, canvas);
      const propertyId = hit?.linked?.propertyId ?? null;
      setHoveredOverlayUnitId(propertyId);
      onHoverOverlay?.(propertyId);
    });
  }, [overlays, resolveHit, onHoverOverlay, canvasRef]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlays?.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const { screenX, screenY } = canvasEventToScreen(canvas, e);
    const hit = resolveHit(screenX, screenY, canvas);
    if (hit?.linked?.propertyId) onClickOverlay?.(hit.linked.propertyId);
  }, [overlays, resolveHit, onClickOverlay, canvasRef]);

  const handleCanvasMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setHoveredOverlayUnitId(null);
    onHoverOverlay?.(null);
  }, [onHoverOverlay]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return {
    hoveredOverlayUnitId,
    handleCanvasMouseMove,
    handleCanvasClick,
    handleCanvasMouseLeave,
  };
}
