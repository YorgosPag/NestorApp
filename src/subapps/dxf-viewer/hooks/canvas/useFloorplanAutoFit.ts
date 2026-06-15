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
  // ADR-399 — auto-fit the floorplan background only ONCE (first appearance).
  // Switching floors must keep the viewport stable (same area across levels); a
  // per-background re-fit would jump the camera on every level change.
  const hasFittedRef = useRef(false);

  useEffect(() => {
    const bg = floorplanBg?.background;
    if (!bg) return;
    if (hasFittedRef.current) return;
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const result = zoomSystem.zoomToFit(
      { min: { x: 0, y: 0 }, max: { x: bg.naturalBounds.width, y: bg.naturalBounds.height } },
      viewport,
      false,
    );
    if (result?.transform) {
      const { scale, offsetX, offsetY } = result.transform;
      if (!isNaN(scale) && !isNaN(offsetX) && !isNaN(offsetY)) {
        hasFittedRef.current = true;
        setTransform(result.transform);
      }
    }
  }, [floorplanBg?.background, viewport.width, viewport.height, zoomSystem, setTransform]);
}
