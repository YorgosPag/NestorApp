/**
 * COPY-PASTE PATCH 3: Quick RAF Mouse Throttle
 * Αντικατάστησε το handleMouseMove στο DxfCanvas.tsx
 */

import { useRef, useCallback } from 'react';

// ═══ COPY-PASTE: RAF Throttled Mouse Handler ═══

const rafId = useRef<number | null>(null);
const lastMousePoint = useRef<{x: number; y: number} | null>(null);

const handleMouseMove = useCallback((event: React.MouseEvent) => {
  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return;

  const point = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };

  // Store latest point
  lastMousePoint.current = point;

  // RAF throttle - μόνο ένα process ανά frame
  if (rafId.current === null) {
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      
      const currentPoint = lastMousePoint.current;
      if (!currentPoint) return;

      // ═══ ACTUAL MOUSE PROCESSING ═══
      try {
        const cm = rendererRef.current?.getCoordinateManager?.();
        if (!cm) return;

        let worldCoords = cm.screenToWorld(currentPoint);
        if (!worldCoords) return;

        // Snapping (αν enabled)
        if (snapEnabled && currentScene?.entities?.length) {
          const snapResult = findSnapPoint(worldCoords);
          if (snapResult.found) {
            worldCoords = snapResult.snappedPoint;
            // Show snap indicator στο overlay
            showSnapIndicator(snapResult);
          } else {
            clearSnapIndicator();
          }
        }

        // Hover detection (αν δεν drag)
        if (!isDragging) {
          const hoveredEntity = findEntityAtWorldPoint(worldCoords);
          updateHoverState(hoveredEntity);
        }

        // Update mouse coordinates
        setMouseWorld(worldCoords);
        setMouseCss(currentPoint);

      } catch (error) {
        console.warn('Mouse processing error:', error);
      }
    });
  }
}, [snapEnabled, currentScene, isDragging]);

// ═══ CLEANUP ═══
useEffect(() => {
  return () => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  };
}, []);

// ═══ HELPER FUNCTIONS ═══

function showSnapIndicator(snapResult: any): void {
  // Overlay snap marker
  rendererRef.current?.renderOverlay?.((ctx: CanvasRenderingContext2D) => {
    const screenPt = rendererRef.current.getCoordinateManager().worldToScreen(snapResult.snappedPoint);
    
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenPt.x, screenPt.y, 8, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  });
}

function clearSnapIndicator(): void {
  // Clear snap overlay
  rendererRef.current?.clearOverlay?.();
}

function findEntityAtWorldPoint(worldPt: {x: number; y: number}): any {
  // TODO: Implement hit testing
  return null;
}

function updateHoverState(entity: any): void {
  if (entity) {
    // Show hover highlight στο overlay
    rendererRef.current?.renderOverlay?.((ctx: CanvasRenderingContext2D) => {
      // Draw hover highlight
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
      ctx.lineWidth = 3;
      // ... highlight drawing
    });
  } else {
    rendererRef.current?.clearOverlay?.();
  }
}

// ═══ EXPORT ═══
export { handleMouseMove };
