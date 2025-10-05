import { useCallback } from 'react';
import type { Point2D } from './config';
import type {
  RulerSettings,
  GridSettings,
  GridBounds,
  GridLine,
  RulerTick,
  RulersLayoutInfo,
  DOMRect,
  ViewTransform
} from './config';
import { RulersGridCalculations, RulersGridRendering } from './utils';

export interface RenderingCalculationsHook {
  calculateGridLines: (bounds: GridBounds) => GridLine[];
  calculateRulerTicks: (type: 'horizontal' | 'vertical', bounds: GridBounds) => RulerTick[];
  calculateLayout: (canvasRect: DOMRect) => RulersLayoutInfo;
  renderGrid: (ctx: CanvasRenderingContext2D, bounds: GridBounds, transform: ViewTransform) => void;
  renderRulers: (
    horizontalCtx: CanvasRenderingContext2D | null,
    verticalCtx: CanvasRenderingContext2D | null,
    layout: RulersLayoutInfo,
    bounds: GridBounds,
    transform: ViewTransform
  ) => void;
}

export function useRenderingCalculations(
  rulers: RulerSettings,
  grid: GridSettings,
  origin: Point2D
): RenderingCalculationsHook {
  // Calculation functions
  const calculateGridLines = useCallback((bounds: GridBounds): GridLine[] => {
    return RulersGridCalculations.calculateGridLines(grid, origin, bounds);
  }, [grid, origin]);

  const calculateRulerTicks = useCallback((
    type: 'horizontal' | 'vertical',
    bounds: GridBounds
  ): RulerTick[] => {
    return RulersGridCalculations.calculateRulerTicks(rulers, type, bounds);
  }, [rulers]);

  const calculateLayout = useCallback((canvasRect: DOMRect): RulersLayoutInfo => {
    return RulersGridCalculations.calculateRulersLayout(rulers, canvasRect);
  }, [rulers]);

  // Rendering functions
  const renderGrid = useCallback((
    ctx: CanvasRenderingContext2D,
    bounds: GridBounds,
    transform: ViewTransform
  ) => {
    if (!grid.visual.enabled) return;
    const lines = calculateGridLines(bounds);
    RulersGridRendering.renderGridLines(ctx, lines, transform);
  }, [grid, calculateGridLines]);

  const renderRulers = useCallback((
    horizontalCtx: CanvasRenderingContext2D | null,
    verticalCtx: CanvasRenderingContext2D | null,
    layout: RulersLayoutInfo,
    bounds: GridBounds,
    transform: ViewTransform
  ) => {
    if (horizontalCtx && rulers.horizontal.enabled) {
      const ticks = calculateRulerTicks('horizontal', bounds);
      RulersGridRendering.renderRuler(horizontalCtx, ticks, rulers.horizontal, 'horizontal', transform);
    }
    
    if (verticalCtx && rulers.vertical.enabled) {
      const ticks = calculateRulerTicks('vertical', bounds);
      RulersGridRendering.renderRuler(verticalCtx, ticks, rulers.vertical, 'vertical', transform);
    }
  }, [rulers, calculateRulerTicks]);

  return {
    calculateGridLines,
    calculateRulerTicks,
    calculateLayout,
    renderGrid,
    renderRulers
  };
}