import { useCallback, useState } from 'react';
import type { Point2D as Point } from '../../types/scene';

interface UseMousePositionProps {
  getCoordinateManager: () => any;
  handleToolHover: (worldPoint: Point | null) => void;
  onMouseMove?: (pt: {x:number; y:number}) => void;
  trackSnapForPoint?: (worldPoint: Point) => void; // ✅ Για live snap tracking
  // Function to check if we are in drawing mode
  isDrawingMode?: () => boolean;
}

interface UseMousePositionReturn {
  mouseCss: Point | null;
  mouseWorld: Point | null;
  updateMousePosition: (screenPoint: Point | null) => void;
}

export function useMousePosition({
  getCoordinateManager,
  handleToolHover,
  onMouseMove,
  trackSnapForPoint,
  isDrawingMode,
}: UseMousePositionProps): UseMousePositionReturn {
  // Mouse position state
  const [mouseCss, setMouseCss] = useState<Point | null>(null);
  const [mouseWorld, setMouseWorld] = useState<Point | null>(null);

  // Update mouse position and calculate snap
  const updateMousePosition = useCallback((screenPoint: Point | null) => {
    setMouseCss(screenPoint);

    if (!screenPoint) {
      // Only clear preview if NOT in drawing mode
      if (isDrawingMode && isDrawingMode()) {
        setMouseCss(null);
        setMouseWorld(null);
        // Don't call handleToolHover(null) to keep preview
        return;
      }
      setMouseWorld(null);
      handleToolHover(null);
      return;
    }

    const cm = getCoordinateManager();
    const worldPoint = cm?.screenToWorld?.(screenPoint);
    setMouseWorld(worldPoint || null);

    if (worldPoint) {
      handleToolHover(worldPoint);
      trackSnapForPoint?.(worldPoint); // Track snap for visual indicators
    }

    // Notify parent about mouse movement for zoom tracking
    onMouseMove?.(screenPoint);
  }, [getCoordinateManager, handleToolHover, onMouseMove, trackSnapForPoint, isDrawingMode]);

  return {
    mouseCss,
    mouseWorld,
    updateMousePosition,
  };
}