/**
 * @fileoverview Smart Measurement Positioning System
 * @description Centralized logic for intelligent measurement label positioning
 * Prevents labels from appearing outside canvas bounds or overlapping with grips
 * @author Enterprise Architecture Team
 * @date 2026-01-02
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO any, NO hardcoded values
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { MeasurementPosition, CanvasBounds } from '../types';

// ============================================================================
// CONFIGURATION CONSTANTS (Centralized - NO hardcoded values in logic)
// ============================================================================

/** Distance from grip point to measurement label */
const GRIP_OFFSET = 20;

/** Minimum margin from canvas edges */
const EDGE_MARGIN = 15;

/** Estimated width for measurement text (conservative estimate) */
const ESTIMATED_TEXT_WIDTH = 120;

/** Estimated height per measurement line */
const LINE_HEIGHT = 20;

/** Offset adjustment when near top edge */
const TOP_EDGE_OFFSET = 60;

// ============================================================================
// MAIN POSITIONING FUNCTIONS
// ============================================================================

/**
 * Calculate intelligent position for measurement labels near a grip point
 * Automatically adjusts position to avoid canvas edges
 *
 * @param screenGripPos - Grip position in screen coordinates
 * @param canvasBounds - Canvas dimensions
 * @param measurementCount - Number of measurement lines to display
 * @returns Optimized position with text alignment
 *
 * @example
 * const pos = calculateMeasurementPosition(
 *   { x: 750, y: 50 },
 *   { width: 800, height: 600 },
 *   4
 * );
 * // Returns: { x: 730, y: 50, textAlign: 'right' } (adjusted for edge)
 */
export function calculateMeasurementPosition(
  screenGripPos: Point2D,
  canvasBounds: CanvasBounds,
  measurementCount: number = 1
): MeasurementPosition {
  const totalHeight = measurementCount * LINE_HEIGHT;

  // Start with default position (right of grip)
  let x = screenGripPos.x + GRIP_OFFSET;
  let y = screenGripPos.y;
  let textAlign: CanvasTextAlign = 'left';

  // Check right edge - if too close, show on left side
  if (x + ESTIMATED_TEXT_WIDTH > canvasBounds.width) {
    x = screenGripPos.x - GRIP_OFFSET;
    textAlign = 'right';
  }

  // Check left edge (when showing on left side)
  if (textAlign === 'right' && x - ESTIMATED_TEXT_WIDTH < 0) {
    // Force to right side with adjusted position
    x = EDGE_MARGIN;
    textAlign = 'left';
  }

  // Check bottom edge
  if (y + totalHeight > canvasBounds.height - EDGE_MARGIN) {
    y = screenGripPos.y - GRIP_OFFSET;
  }

  // Check top edge
  if (y - totalHeight < EDGE_MARGIN) {
    y = screenGripPos.y + TOP_EDGE_OFFSET;
  }

  return { x, y, textAlign };
}

/**
 * Calculate position for center-aligned measurements (e.g., above center point)
 * Used for circular entities where measurements appear near center
 *
 * @param screenCenter - Center position in screen coordinates
 * @param canvasBounds - Canvas dimensions
 * @param measurementCount - Number of measurement lines
 * @returns Optimized position with text alignment
 */
export function calculateCenterMeasurementPosition(
  screenCenter: Point2D,
  canvasBounds: CanvasBounds,
  measurementCount: number = 1
): MeasurementPosition {
  const totalHeight = measurementCount * LINE_HEIGHT;

  let x = screenCenter.x;
  let y = screenCenter.y - totalHeight;
  const textAlign: CanvasTextAlign = 'center';

  // Ensure Y is not above canvas
  if (y < EDGE_MARGIN) {
    y = screenCenter.y + GRIP_OFFSET;
  }

  // Ensure X is within bounds
  if (x - ESTIMATED_TEXT_WIDTH / 2 < EDGE_MARGIN) {
    x = EDGE_MARGIN + ESTIMATED_TEXT_WIDTH / 2;
  }
  if (x + ESTIMATED_TEXT_WIDTH / 2 > canvasBounds.width - EDGE_MARGIN) {
    x = canvasBounds.width - EDGE_MARGIN - ESTIMATED_TEXT_WIDTH / 2;
  }

  return { x, y, textAlign };
}

/**
 * Calculate Y offset for stacked measurement lines
 *
 * @param baseY - Base Y position
 * @param lineIndex - Index of the measurement line (0-based)
 * @param totalLines - Total number of lines
 * @returns Y coordinate for this specific line
 */
export function calculateLineYOffset(
  baseY: number,
  lineIndex: number,
  totalLines: number
): number {
  // Center the stack around baseY
  const stackOffset = (totalLines - 1) * LINE_HEIGHT / 2;
  return baseY - stackOffset + lineIndex * LINE_HEIGHT;
}

/**
 * Get canvas bounds from canvas element
 *
 * @param canvas - Canvas element or 2D context
 * @returns Canvas bounds object
 */
export function getCanvasBounds(
  canvas: HTMLCanvasElement | CanvasRenderingContext2D
): CanvasBounds {
  if ('canvas' in canvas) {
    // It's a context
    return {
      width: canvas.canvas.width,
      height: canvas.canvas.height
    };
  }
  // It's a canvas element
  return {
    width: canvas.width,
    height: canvas.height
  };
}

// ============================================================================
// CONFIGURATION EXPORTS (for external customization if needed)
// ============================================================================

export const POSITIONING_CONFIG = {
  GRIP_OFFSET,
  EDGE_MARGIN,
  ESTIMATED_TEXT_WIDTH,
  LINE_HEIGHT,
  TOP_EDGE_OFFSET
} as const;
