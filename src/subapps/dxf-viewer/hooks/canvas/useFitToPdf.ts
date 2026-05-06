'use client';

import { useEffect, useRef } from 'react';
import { usePdfBackgroundStore } from '../../pdf-background/stores/pdfBackgroundStore';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';

interface ZoomSystemLike {
  zoomToFit: (
    bounds: { min: Point2D; max: Point2D },
    viewport: { width: number; height: number },
    alignToOrigin?: boolean,
  ) => { transform: ViewTransform } | null;
}

interface UseFitToPdfParams {
  zoomSystem: ZoomSystemLike;
  setTransform: (t: ViewTransform) => void;
  viewport: { width: number; height: number };
}

/**
 * Auto-fits the canvas view to PDF dimensions on first load of each unique PDF URL.
 * User manual zoom after fit is not reset (guards via lastFittedRef).
 */
export function useFitToPdf({ zoomSystem, setTransform, viewport }: UseFitToPdfParams): void {
  const pdfImageUrl = usePdfBackgroundStore(s => s.renderedImageUrl);
  const pdfEnabled = usePdfBackgroundStore(s => s.enabled);
  const pageDimensions = usePdfBackgroundStore(s => s.pageDimensions);
  const lastFittedRef = useRef<string | null>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  useEffect(() => {
    if (!pdfImageUrl || !pdfEnabled) return;
    if (lastFittedRef.current === pdfImageUrl) return;
    if (viewport.width <= 0 || viewport.height <= 0) return;

    const fitWithSize = (w: number, h: number) => {
      const vp = viewportRef.current;
      if (vp.width <= 0 || vp.height <= 0 || w <= 0 || h <= 0) return;
      const result = zoomSystem.zoomToFit(
        { min: { x: 0, y: 0 }, max: { x: w, y: h } },
        vp,
        false
      );
      if (result?.transform) {
        const { scale, offsetX, offsetY } = result.transform;
        if (!isNaN(scale) && !isNaN(offsetX) && !isNaN(offsetY)) {
          lastFittedRef.current = pdfImageUrl;
          setTransform(result.transform);
        }
      }
    };

    if (pageDimensions) {
      fitWithSize(pageDimensions.width, pageDimensions.height);
    } else {
      const img = new Image();
      img.onload = () => fitWithSize(img.width, img.height);
      img.onerror = () => { /* silent — URL may be CORS-restricted */ };
      img.src = pdfImageUrl;
    }
  }, [pdfImageUrl, pdfEnabled, pageDimensions, viewport.width, viewport.height, zoomSystem, setTransform]);
}
