/**
 * Shared canvas setup hook
 * Eliminates duplicate canvas sizing and DPR logic between overlays
 */
import { useEffect, RefObject } from 'react';

interface UseCanvasSetupOptions {
  viewport: { width: number; height: number };
  imageSmoothingEnabled?: boolean;
}

export function useCanvasSetup(
  canvasRef: RefObject<HTMLCanvasElement>,
  { viewport, imageSmoothingEnabled = false }: UseCanvasSetupOptions
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const width = viewport.width;
      const height = viewport.height;
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = imageSmoothingEnabled;
      }
    };

    updateCanvasSize();
    
    // Return cleanup function if needed
    return () => {
      // Cleanup canvas if necessary
    };
  }, [canvasRef, viewport.width, viewport.height, imageSmoothingEnabled]);
}