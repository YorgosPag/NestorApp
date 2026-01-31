/**
 * CURSOR SYSTEM UTILITIES
 * Helper functions for cursor calculations and transformations
 */

import type { CursorSettings, CursorState } from './config';
import type { Point2D, Viewport } from '../../rendering/types/Types';
import { COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-095: Centralized Snap Tolerance
import { SNAP_TOLERANCE } from '../../config/tolerance-config';

// Cursor calculation utilities
export interface CursorUtils {
  calculateCrosshairSize: (viewport: Viewport, settings: CursorSettings) => number;
  isPointNearCursor: (point: Point2D, cursorPos: Point2D, tolerance: number) => boolean;
  throttleMouseEvents: (callback: (event: MouseEvent) => void, ms: number) => (event: MouseEvent) => void;
  getDevicePixelRatio: () => number;
  scaleCrosshairForDPR: (size: number, dpr: number) => number;
}

/**
 * Calculate crosshair size based on viewport and settings
 * 🔧 FIXED: Remove DPI scaling to prevent double scaling (ChatGPT recommendation)
 */
export function calculateCrosshairSize(
  viewport: Viewport,
  settings: CursorSettings
): number {
  const baseSize = Math.min(viewport.width, viewport.height) * (settings.crosshair.size_percent / 100);
  // ✅ REMOVED DPI SCALING - Business logic should be independent of device DPI
  // DPI scaling is handled in CanvasUtils.setupCanvasContext, not in business logic
  return baseSize * settings.crosshair.ui_scale;
}

/**
 * Check if a point is near the cursor position
 */
export function isPointNearCursor(
  point: Point2D,
  cursorPos: Point2D,
  tolerance: number = SNAP_TOLERANCE // 🏢 ADR-095: Centralized default
): boolean {
  // 🏢 ADR-065: Use centralized distance calculation
  return calculateDistance(point, cursorPos) <= tolerance;
}

/**
 * Throttle mouse events for performance
 */
export function throttleMouseEvents(
  callback: (event: MouseEvent) => void, 
  ms: number
): (event: MouseEvent) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return (event: MouseEvent) => {
    const now = Date.now();
    
    if (now - lastCall >= ms) {
      lastCall = now;
      callback(event);
    } else {
      // Clear any pending delayed call
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Schedule a delayed call to ensure the last event isn't lost
      timeoutId = setTimeout(() => {
        callback(event);
        lastCall = Date.now();
        timeoutId = null;
      }, ms - (now - lastCall));
    }
  };
}

/**
 * Get current device pixel ratio
 */
export function getDevicePixelRatio(): number {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

/**
 * Scale crosshair size for device pixel ratio
 */
export function scaleCrosshairForDPR(size: number, dpr: number): number {
  return Math.round(size * dpr) / dpr;
}

/**
 * Create RAF-based animation loop for cursor updates
 */
export function createCursorAnimationLoop(
  callback: (timestamp: number) => void
): () => void {
  let animationId: number;
  let isRunning = false;

  const loop = (timestamp: number) => {
    if (isRunning) {
      callback(timestamp);
      animationId = requestAnimationFrame(loop);
    }
  };

  // Start the loop
  const start = () => {
    if (!isRunning) {
      isRunning = true;
      animationId = requestAnimationFrame(loop);
    }
  };

  // Stop the loop
  const stop = () => {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  };

  // Auto-start and return stop function
  start();
  return stop;
}

/**
 * Validate cursor state
 */
export function isValidCursorState(state: Partial<CursorState>): state is CursorState {
  return !!(
    state.position && 
    state.viewport && 
    typeof state.isActive === 'boolean' &&
    typeof state.tool === 'string'
  );
}

/**
 * Create a default cursor state
 * ✅ PROFESSIONAL CAD STATE: Περιλαμβάνει όλα τα απαραίτητα fields για CAD operations
 */
export function createDefaultCursorState(): CursorState {
  return {
    // ✅ MOUSE POSITION TRACKING (κεντρικό για όλα τα UI elements)
    position: null,                    // Screen coordinates
    worldPosition: null,               // World coordinates
    viewport: { width: 0, height: 0 }, // Current viewport

    // ✅ MOUSE BUTTON STATE (for professional CAD interactions)
    isDown: false,                     // Any mouse button down
    button: 0,                         // Which button (0=left, 1=middle, 2=right)

    // ✅ CAD-SPECIFIC STATE
    isActive: false,                   // Mouse is in canvas area
    tool: 'default',                   // Current CAD tool
    snapPoint: null,                   // Current snap target

    // ✅ SELECTION STATE (for CAD selection operations)
    isSelecting: false,                // Selection operation in progress
    selectionStart: null,              // Selection box start
    selectionCurrent: null,            // Current selection position
  };
}

/**
 * Format cursor coordinates for display
 */
export function formatCursorCoordinates(
  position: Point2D | null,
  precision: number = 2
): string {
  if (!position) return 'N/A';
  return `X: ${position.x.toFixed(precision)}, Y: ${position.y.toFixed(precision)}`;
}

/**
 * Check if cursor settings are valid
 */
export function validateCursorSettings(settings: Partial<CursorSettings>): boolean {
  try {
    return !!(
      settings.crosshair &&
      settings.behavior &&
      settings.performance &&
      typeof settings.crosshair.enabled === 'boolean' &&
      typeof settings.crosshair.size_percent === 'number' &&
      settings.crosshair.size_percent > 0 &&
      settings.crosshair.size_percent <= 100
    );
  } catch {
    return false;
  }
}

/**
 * ✅ CURSOR FIX: Check if point is in ruler area using existing COORDINATE_LAYOUT
 * Uses existing ruler dimensions from rulers-grid/config.ts
 */
export function isPointInRulerArea(
  point: Point2D,
  canvas: HTMLCanvasElement
): boolean {
  if (!canvas) return false;

  const canvasDimensions = CanvasUtils.getCanvasDimensions(canvas);

  // Use existing ruler dimensions from COORDINATE_LAYOUT
  const rulerLeftWidth = COORDINATE_LAYOUT.RULER_LEFT_WIDTH;
  const rulerBottomHeight = COORDINATE_LAYOUT.MARGINS.bottom;

  // Convert screen point to canvas coordinates
  const canvasPoint = CanvasUtils.screenToCanvas(point, canvas);

  // Check if point is in vertical ruler area (left side)
  const isInVerticalRuler = canvasPoint.x >= 0 &&
                           canvasPoint.x <= rulerLeftWidth &&
                           canvasPoint.y >= 0 &&
                           canvasPoint.y <= canvasDimensions.height;

  // Check if point is in horizontal ruler area (bottom)
  const horizontalRulerY = canvasDimensions.height - rulerBottomHeight;
  const isInHorizontalRuler = canvasPoint.y >= horizontalRulerY &&
                             canvasPoint.y <= canvasDimensions.height &&
                             canvasPoint.x >= 0 &&
                             canvasPoint.x <= canvasDimensions.width;

  return isInVerticalRuler || isInHorizontalRuler;
}