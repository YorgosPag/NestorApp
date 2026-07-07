// ⚠️ ARCHITECTURE-CRITICAL — ADR-040. Extracted from CanvasLayerStack to keep the
// shell <500 lines (N.7.1). Behaviour-preserving: these stay memoized via useCallback
// with the SAME dependency lists they had inline (scene/colorLayers read through the
// stable refs the shell already maintains — no subscription, ADR-040 safe).
import { useCallback } from 'react';
import { createCombinedBounds } from '../../systems/zoom/utils/bounds';
import { getImmediatePosition } from '../../systems/cursor/ImmediatePositionStore';
import { resolveSceneUnits } from '../../utils/scene-units';
import { dwarn } from '../../debug';
import type { CanvasLayerStackProps } from './canvas-layer-stack-types';

type Deps = Pick<CanvasLayerStackProps, 'zoomSystem' | 'viewport'> & {
  /** Stable ref to the active DXF scene (imperative reads only — ADR-040). */
  sceneRef: React.MutableRefObject<CanvasLayerStackProps['dxfScene']>;
  /** Stable ref to the colour layers (imperative reads only — ADR-040). */
  colorLayersRef: React.MutableRefObject<CanvasLayerStackProps['colorLayers']>;
};

export interface CanvasLayerStackZoomHandlers {
  handleRulerZoomToFit: () => void;
  handleRulerWheelZoom: (delta: number) => void;
  handleZoomActualSize: () => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomPrevious: () => void;
  handleZoomToRatio: (ratioN: number) => void;
}

/**
 * Ruler/zoom action callbacks for {@link CanvasLayerStack}. Identical memoization to the
 * previous inline form so the shell's downstream memos stay effective (ADR-040).
 */
export function useCanvasLayerStackZoomHandlers({
  zoomSystem,
  viewport,
  sceneRef,
  colorLayersRef,
}: Deps): CanvasLayerStackZoomHandlers {
  const handleRulerZoomToFit = useCallback(() => {
    const combinedBounds = createCombinedBounds(sceneRef.current, colorLayersRef.current, true);
    if (combinedBounds && viewport.width > 0 && viewport.height > 0) {
      zoomSystem.zoomToFit(combinedBounds, viewport, true);
    } else {
      dwarn('CanvasLayerStack', 'ZoomToFit: Invalid bounds or viewport!', {
        combinedBounds,
        viewport,
      });
    }
  }, [viewport, zoomSystem, sceneRef, colorLayersRef]);
  const handleRulerWheelZoom = useCallback((delta: number) => {
    const cssPos = getImmediatePosition();
    if (cssPos) {
      zoomSystem.handleWheelZoom(delta, cssPos);
    }
  }, [zoomSystem]);
  // 🏢 ADR-418: zoom to 1:1 actual size — units resolved imperatively (ADR-040: no subscription)
  const handleZoomActualSize = useCallback(
    () => zoomSystem.zoomToActualSize(resolveSceneUnits(sceneRef.current)),
    [zoomSystem, sceneRef],
  );
  const handleZoomIn = useCallback(() => zoomSystem.zoomIn(), [zoomSystem]);
  const handleZoomOut = useCallback(() => zoomSystem.zoomOut(), [zoomSystem]);
  const handleZoomPrevious = useCallback(() => zoomSystem.zoomPrevious(), [zoomSystem]);
  // 🏢 ADR-418: preset/menu now passes a drawing-scale ratio N (1:N)
  const handleZoomToRatio = useCallback(
    (ratioN: number) => zoomSystem.zoomToRatio(ratioN, resolveSceneUnits(sceneRef.current)),
    [zoomSystem, sceneRef],
  );
  return {
    handleRulerZoomToFit,
    handleRulerWheelZoom,
    handleZoomActualSize,
    handleZoomIn,
    handleZoomOut,
    handleZoomPrevious,
    handleZoomToRatio,
  };
}
