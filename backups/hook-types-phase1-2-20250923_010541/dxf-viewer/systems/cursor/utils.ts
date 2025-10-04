/**
 * CURSOR SYSTEM UTILITIES
 * Helper functions for cursor calculations and transformations
 */

import type { CursorSettings, CursorState } from './config';
import type { Point2D } from '../coordinates/config';

// Cursor calculation utilities
export interface CursorUtils {
  calculateCrosshairSize: (viewport: { width: number; height: number }, settings: CursorSettings) => number;
  isPointNearCursor: (point: Point2D, cursorPos: Point2D, tolerance: number) => boolean;
  throttleMouseEvents: (callback: (event: MouseEvent) => void, ms: number) => (event: MouseEvent) => void;
  getDevicePixelRatio: () => number;
  scaleCrosshairForDPR: (size: number, dpr: number) => number;
}

/**
 * Calculate crosshair size based on viewport and settings
 */
export function calculateCrosshairSize(
  viewport: { width: number; height: number }, 
  settings: CursorSettings
): number {
  const baseSize = Math.min(viewport.width, viewport.height) * (settings.crosshair.size_percent / 100);
  const dpr = settings.crosshair.lock_to_dpr ? getDevicePixelRatio() : 1;
  return scaleCrosshairForDPR(baseSize * settings.crosshair.ui_scale, dpr);
}

/**
 * Check if a point is near the cursor position
 */
export function isPointNearCursor(
  point: Point2D, 
  cursorPos: Point2D, 
  tolerance: number = 10
): boolean {
  const dx = point.x - cursorPos.x;
  const dy = point.y - cursorPos.y;
  return Math.sqrt(dx * dx + dy * dy) <= tolerance;
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
 */
export function createDefaultCursorState(): CursorState {
  return {
    position: null,
    viewport: { width: 0, height: 0 },
    isActive: false,
    tool: 'default',
    snapPoint: null,
    worldPosition: null,
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