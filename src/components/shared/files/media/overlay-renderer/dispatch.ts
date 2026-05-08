/**
 * Overlay renderer — geometry-aware dispatch.
 *
 * Single entry point for rendering an overlay from the new SSoT shape
 * (`FloorplanOverlay`). Switches on `geometry.type` to invoke the
 * corresponding shape draw helper. Resolves colors via `colors.ts`.
 *
 * Used by STEP F+ consumers (multi-kind overlays). Legacy polygon-only
 * consumers keep using `legacy.ts → renderOverlayPolygons`.
 *
 * @module components/shared/files/media/overlay-renderer/dispatch
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import { resolvePolygonColors, resolveAnnotationStroke } from './colors';
import { drawPolygon } from './polygon';
import { drawLine } from './line';
import { drawCircle } from './circle';
import { drawArc } from './arc';
import { drawDimension } from './dimension';
import { drawMeasurement } from './measurement';
import { drawText } from './text';
import type {
  FloorplanOverlay,
  SceneBounds,
  FitTransform,
  OverlayRenderContext,
} from './types';

const DEFAULT_STROKE_WIDTH = 3;
const DEFAULT_STROKE_WIDTH_HIGHLIGHTED = 4;

/**
 * Render one overlay onto `ctx`. Caller manages `save()/restore()` if
 * state isolation is needed across overlays.
 */
export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: FloorplanOverlay,
  bounds: SceneBounds,
  fit: FitTransform,
  context: OverlayRenderContext = {},
): void {
  const isHighlighted = !!context.isHighlighted;
  const lineWidth = isHighlighted
    ? context.strokeWidthHighlighted ?? DEFAULT_STROKE_WIDTH_HIGHLIGHTED
    : context.strokeWidth ?? DEFAULT_STROKE_WIDTH;

  const g = overlay.geometry;
  switch (g.type) {
    case 'polygon': {
      const colors = resolvePolygonColors(
        context.resolvedStatus,
        isHighlighted,
        context.styleOverride ?? overlay.style,
      );
      drawPolygon(ctx, g.vertices, g.closed ?? true, bounds, fit, {
        stroke: colors.stroke,
        fill: colors.fill,
        lineWidth,
      });
      return;
    }
    case 'line': {
      const stroke = resolveAnnotationStroke(isHighlighted, context.styleOverride ?? overlay.style);
      drawLine(ctx, g.start, g.end, bounds, fit, { stroke, lineWidth });
      return;
    }
    case 'circle': {
      const stroke = resolveAnnotationStroke(isHighlighted, context.styleOverride ?? overlay.style);
      drawCircle(ctx, g.center, g.radius, bounds, fit, { stroke, lineWidth });
      return;
    }
    case 'arc': {
      const stroke = resolveAnnotationStroke(isHighlighted, context.styleOverride ?? overlay.style);
      drawArc(
        ctx,
        g.center,
        g.radius,
        g.startAngle,
        g.endAngle,
        !!g.counterclockwise,
        bounds,
        fit,
        { stroke, lineWidth },
      );
      return;
    }
    case 'dimension': {
      const stroke = resolveAnnotationStroke(isHighlighted, context.styleOverride ?? overlay.style);
      drawDimension(
        ctx,
        { from: g.from, to: g.to, value: g.value, unit: g.unit },
        bounds,
        fit,
        { stroke, lineWidth },
        context.unitsPerMeter,
      );
      return;
    }
    case 'measurement': {
      const stroke = resolveAnnotationStroke(isHighlighted, context.styleOverride ?? overlay.style);
      drawMeasurement(
        ctx,
        { points: g.points, mode: g.mode, value: g.value, unit: g.unit },
        bounds,
        fit,
        { stroke, lineWidth },
      );
      return;
    }
    case 'text': {
      const stroke = resolveAnnotationStroke(isHighlighted, context.styleOverride ?? overlay.style);
      drawText(
        ctx,
        { position: g.position, text: g.text, fontSize: g.fontSize, rotation: g.rotation },
        bounds,
        fit,
        { stroke: '#000000', fill: stroke },
      );
      return;
    }
  }
}
