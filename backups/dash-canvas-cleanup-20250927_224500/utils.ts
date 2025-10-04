// ✅ Debug flag for selection marquee logging
const DEBUG_CANVAS_CORE = false;

import type { Point2D } from '../../types/scene';
import type { RectGeometry, SelectionColors, MarqueeKind } from './types';
import { getCursorSettings } from '../../systems/cursor/config';

/**
 * Calculate rectangle geometry from start and end points
 */
export function calculateRectGeometry(start: Point2D, end: Point2D): RectGeometry {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
}

/**
 * Get colors for selection from cursor settings
 */
export function getSelectionColors(kind: MarqueeKind): SelectionColors {
  const settings = getCursorSettings();
  
  if (kind === 'window') {
    const { fillColor, fillOpacity, borderColor, borderOpacity, borderStyle, borderWidth } = settings.selection.window;
    const result = { 
      borderColor: `${borderColor}${Math.round(borderOpacity * 255).toString(16).padStart(2, '0')}`,
      fillColor: `${fillColor}${Math.round(fillOpacity * 255).toString(16).padStart(2, '0')}`,
      borderStyle,
      borderWidth
    };

    return result;
  } else {
    const { fillColor, fillOpacity, borderColor, borderOpacity, borderStyle, borderWidth } = settings.selection.crossing;
    const result = { 
      borderColor: `${borderColor}${Math.round(borderOpacity * 255).toString(16).padStart(2, '0')}`,
      fillColor: `${fillColor}${Math.round(fillOpacity * 255).toString(16).padStart(2, '0')}`,
      borderStyle,
      borderWidth
    };

    return result;
  }
}

/**
 * Calculate if polygon is counter-clockwise (Window) or clockwise (Crossing)
 */
export function isCounterClockwise(points: Point2D[]): boolean {
  if (points.length < 3) return true;
  
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  
  return area < 0; // Negative area = CCW
}

/**
 * Generate SVG path data from points
 */
export function generateSVGPath(points: Point2D[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

/**
 * Filter out invalid/null points
 */
export function filterValidPoints(points: Point2D[]): Point2D[] {
  return points.filter(Boolean);
}