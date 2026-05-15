import { useRef, useEffect } from 'react';
import type { FloorplanBackgroundForLevelResult } from '../../floorplan-background';
import { useZoom } from '../../systems/zoom';

interface UseFloorplanAutoFitProps {
  floorplanBg: FloorplanBackgroundForLevelResult | null;
  viewport: { width: number; height: number };
  zoomSystem: ReturnType<typeof useZoom>;
  setTransform: (t: { scale: number; offsetX: number; offsetY: number }) => void;
}

export function useFloorplanAutoFit({ floorplanBg, viewport, zoomSystem, setTransform }: UseFloorplanAutoFitProps) {
  const lastFittedBgIdRef = useRef<string | null>(null);

  useEffect(() => {
    const bg = floorplanBg?.background;
    if (!bg) return;
    if (lastFittedBgIdRef.current === bg.id) return;
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const result = zoomSystem.zoomToFit(
      { min: { x: 0, y: 0 }, max: { x: bg.naturalBounds.width, y: bg.naturalBounds.height } },
      viewport,
      false,
    );
    if (result?.transform) {
      const { scale, offsetX, offsetY } = result.transform;
      if (!isNaN(scale) && !isNaN(offsetX) && !isNaN(offsetY)) {
        lastFittedBgIdRef.current = bg.id;
        setTransform(result.transform);
      }
    }
  }, [floorplanBg?.background, viewport.width, viewport.height, zoomSystem, setTransform]);
}
