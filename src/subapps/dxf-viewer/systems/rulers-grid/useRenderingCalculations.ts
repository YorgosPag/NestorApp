import { useCallback } from 'react';
import type { Point2D } from './config';
import type {
  RulerSettings,
  GridSettings,
  GridBounds,
  GridLine,
  RulerTick,
  RulersLayoutInfo,
  ViewTransform
} from './config';
import { RulersGridCalculations, RulersGridRendering } from './utils';

export interface RenderingCalculationsHook {
  calculateGridLines: (bounds: GridBounds, transform: ViewTransform) => GridLine[];
  calculateRulerTicks: (type: 'horizontal' | 'vertical', bounds: GridBounds, transform: ViewTransform, canvasRect: { width: number; height: number }) => RulerTick[];
  calculateLayout: (canvasRect: { width: number; height: number }) => RulersLayoutInfo;
  renderGrid: (ctx: CanvasRenderingContext2D, bounds: GridBounds, transform: ViewTransform) => void;
}

export function useRenderingCalculations(
  rulers: RulerSettings,
  grid: GridSettings,
  origin: Point2D
): RenderingCalculationsHook {
  // Calculation functions
  const calculateGridLines = useCallback((bounds: GridBounds, transform: ViewTransform): GridLine[] => {
    return RulersGridCalculations.generateGridLines(bounds, grid, transform);
  }, [grid]);

  const calculateRulerTicks = useCallback((
    type: 'horizontal' | 'vertical',
    bounds: GridBounds,
    transform: ViewTransform,
    canvasRect: { width: number; height: number }
  ): RulerTick[] => {
    // 🏢 ENTERPRISE: Cast to DOMRect since calculateTicks only uses width/height properties
    return RulersGridCalculations.calculateTicks(type, bounds, rulers, transform, canvasRect as DOMRect);
  }, [rulers]);

  const calculateLayout = useCallback((canvasRect: { width: number; height: number }): RulersLayoutInfo => {
    // 🏢 ENTERPRISE: Cast to DOMRect since calculateLayout only uses width/height properties
    return RulersGridCalculations.calculateLayout(canvasRect as DOMRect, rulers);
  }, [rulers]);

  // Rendering functions
  const renderGrid = useCallback((
    ctx: CanvasRenderingContext2D,
    bounds: GridBounds,
    transform: ViewTransform
  ) => {
    if (!grid.visual.enabled) return;
    const lines = calculateGridLines(bounds, transform);
    RulersGridRendering.renderGridLines(ctx, lines, transform);
  }, [grid, calculateGridLines]);

  return {
    calculateGridLines,
    calculateRulerTicks,
    calculateLayout,
    renderGrid
  };
}