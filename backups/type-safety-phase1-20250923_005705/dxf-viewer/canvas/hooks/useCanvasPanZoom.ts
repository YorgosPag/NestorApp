import { useCallback, useRef, useState } from 'react';
import type { Point2D as Point } from '../../types/scene';
import { createMouseUtils } from '../../utils/canvas-core';

interface UseCanvasPanZoomProps {
  rendererRef: React.RefObject<any>;
  onTransformChange?: (transform: any) => void;
  activeTool: string;
}

interface UseCanvasPanZoomReturn {
  isPanning: boolean;
  handleWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  handlePanMouseDown: (point: Point, e?: React.MouseEvent<HTMLCanvasElement>) => boolean;
  handlePanMouseMove: (point: Point) => void;
  handlePanMouseUp: () => void;
  zoomAtScreenPoint: (factor: number, screenPt: Point) => void;
}

export function useCanvasPanZoom({ 
  rendererRef, 
  onTransformChange,
  activeTool
}: UseCanvasPanZoomProps): UseCanvasPanZoomReturn {
  // Zoom constants
  const ZOOM_FACTOR = 1.2;
  const MIN_SCALE = 0.01;
  const MAX_SCALE = 200;

  // RAF throttling για wheel
  const rafWheelRef = useRef<number | null>(null);

  // Pan refs and state
  const [isPanning, setIsPanning] = useState(false);
  const panActiveRef = useRef(false);
  const panLastPointRef = useRef<Point | null>(null);

  // helper: ζουμάρει γύρω από ένα screen-point κρατώντας σταθερό το world σημείο
  const zoomAtScreenPoint = useCallback((factor: number, screenPt: Point) => {
    if (!rendererRef.current) return;
    
    // Χρησιμοποιώ την zoom function του renderer που είναι cursor-centric
    if (rendererRef.current.zoom) {
      rendererRef.current.zoom(factor, screenPt);
      onTransformChange?.(rendererRef.current.getTransform());
    }
  }, [rendererRef, onTransformChange]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    console.debug('🔍 Wheel event!', e.deltaY);
    e.preventDefault();
    if (rafWheelRef.current) return;
    
    // Capture event data outside RAF to avoid stale references
    const mouseUtils = createMouseUtils();
    const pt = mouseUtils.getScreenPointFromEvent(e);
    const deltaY = e.deltaY;

    rafWheelRef.current = requestAnimationFrame(() => {
      rafWheelRef.current = null;

      // πιο ομαλό σε trackpads: μικρό εκθετικό βήμα
      const step = Math.pow(1.0015, -deltaY);
      const factor = step > 1 ? Math.min(step, ZOOM_FACTOR) : Math.max(step, 1/ZOOM_FACTOR);

      console.debug('🔍 Wheel zoom:', factor, pt);
      zoomAtScreenPoint(factor, pt);  // ήδη υλοποιημένο
    });
  }, [zoomAtScreenPoint, ZOOM_FACTOR]);

  const handlePanMouseDown = useCallback((point: Point, e?: React.MouseEvent<HTMLCanvasElement>) => {
    // Pan: Μεσαίο κουμπί ή αριστερό με pan tool
    const isPanAction = (e?.button === 1) || (e?.button === 0 && activeTool === 'pan');
    
    if (isPanAction) {
      e?.preventDefault();
      e?.stopPropagation();
      panActiveRef.current = true;
      setIsPanning(true);
      panLastPointRef.current = point; // Store starting point for delta calculation
      return true; // indicates pan started
    }
    
    return false; // pan not started
  }, [activeTool]);

  const handlePanMouseMove = useCallback((point: Point) => {
    // Pan handling - check if pan is active
    if (panActiveRef.current && panLastPointRef.current && rendererRef.current) {
      // Calculate incremental delta from last mouse position
      const deltaX = point.x - panLastPointRef.current.x;
      const deltaY = point.y - panLastPointRef.current.y;
      
      // Only pan if there's actual movement
      if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
        // Apply incremental pan
        if (rendererRef.current.pan) {
          rendererRef.current.pan(deltaX, deltaY);
          onTransformChange?.(rendererRef.current.getTransform());
        }
        
        // Update last position for next delta calculation
        panLastPointRef.current = point;
      }
    }
  }, [rendererRef, onTransformChange]);

  const handlePanMouseUp = useCallback(() => {
    // End pan if active
    if (panActiveRef.current) {
      panActiveRef.current = false;
      setIsPanning(false);
      panLastPointRef.current = null;
      return;
    }
  }, []);

  return {
    isPanning,
    handleWheel,
    handlePanMouseDown,
    handlePanMouseMove,
    handlePanMouseUp,
    zoomAtScreenPoint,
  };
}