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
  const calculateGridLines = useCallback((bounds: GridBounds, transform: ViewTransform): GridLine[] => {
    return RulersGridCalculations.generateGridLines(bounds, grid, transform);
  }, [grid]);

  const calculateRulerTicks = useCallback((
    type: 'horizontal' | 'vertical',
    bounds: GridBounds,
    transform: ViewTransform,
    canvasRect: { width: number; height: number }
  ): RulerTick[] => {
    return RulersGridCalculations.calculateTicks(type, bounds, rulers, transform, canvasRect as any);
  }, [rulers]);

  const calculateLayout = useCallback((canvasRect: { width: number; height: number }): RulersLayoutInfo => {
    return RulersGridCalculations.calculateLayout(canvasRect as any, rulers);
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

  const renderRulers = useCallback((
    horizontalCtx: CanvasRenderingContext2D | null,
    verticalCtx: CanvasRenderingContext2D | null,
    layout: RulersLayoutInfo,
    bounds: GridBounds,
    transform: ViewTransform
  ) => {
    if (horizontalCtx && rulers.horizontal.enabled) {
      const canvasRect = { width: horizontalCtx.canvas.width, height: horizontalCtx.canvas.height };
      const ticks = calculateRulerTicks('horizontal', bounds, transform, canvasRect);
      RulersGridRendering.renderRuler(horizontalCtx, ticks, rulers.horizontal, 'horizontal', transform);
    }

    if (verticalCtx && rulers.vertical.enabled) {
      const canvasRect = { width: verticalCtx.canvas.width, height: verticalCtx.canvas.height };
      const ticks = calculateRulerTicks('vertical', bounds, transform, canvasRect);
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