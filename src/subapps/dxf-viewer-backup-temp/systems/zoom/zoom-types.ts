/**
 * ZOOM SYSTEM - TYPES & INTERFACES
 * Τύποι για το κεντρικοποιημένο zoom system
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';

// === ZOOM MODES ===
export type ZoomMode =
  | 'wheel'      // Mouse wheel zoom
  | 'keyboard'   // +/- keys
  | 'window'     // Rectangle selection
  | 'fit'        // Fit to view/extents
  | 'center'     // Center-based zoom
  | 'selection'  // Zoom to selected objects
  | 'scale'      // Specific scale (1:100)
  | 'previous';  // Previous view

// === ZOOM DIRECTION ===
export type ZoomDirection = 'in' | 'out';

// === ZOOM CONFIGURATION ===
export interface ZoomConfig {
  // Scale limits
  minScale: number;
  maxScale: number;

  // Zoom factors
  wheelFactor: number;
  keyboardFactor: number;

  // Animation
  animated: boolean;
  animationDuration: number;

  // Behavior
  zoomToCursor: boolean;
  restrictToContent: boolean;
}

// === ZOOM OPERATION ===
export interface ZoomOperation {
  mode: ZoomMode;
  direction?: ZoomDirection;
  center?: Point2D;
  targetScale?: number;
  bounds?: {
    min: Point2D;
    max: Point2D;
  };
  animated?: boolean;
}

// === ZOOM RESULT ===
export interface ZoomResult {
  transform: ViewTransform;
  scale: number;
  center: Point2D;
  bounds: {
    min: Point2D;
    max: Point2D;
  };
  mode: ZoomMode;
  timestamp: number;
}

// === ZOOM HISTORY ===
export interface ZoomHistoryEntry {
  transform: ViewTransform;
  timestamp: number;
  mode: ZoomMode;
}

// === ZOOM CONSTRAINTS ===
export interface ZoomConstraints {
  contentBounds?: {
    min: Point2D;
    max: Point2D;
  };
  viewport: {
    width: number;
    height: number;
  };
  minScale?: number;
  maxScale?: number;
}

// === ZOOM EVENT ===
export interface ZoomEvent {
  type: 'zoom-start' | 'zoom-change' | 'zoom-end';
  operation: ZoomOperation;
  result: ZoomResult;
  source: 'user' | 'programmatic';
}

// === ZOOM MANAGER INTERFACE ===
export interface IZoomManager {
  // Core operations
  zoomIn(center?: Point2D, constraints?: ZoomConstraints): ZoomResult;
  zoomOut(center?: Point2D, constraints?: ZoomConstraints): ZoomResult;
  zoomToFit(bounds: { min: Point2D; max: Point2D }, viewport: { width: number; height: number }): ZoomResult;
  zoomToScale(scale: number, center?: Point2D): ZoomResult;
  zoomToWindow(startPoint: Point2D, endPoint: Point2D, viewport: { width: number; height: number }): ZoomResult;

  // History
  zoomPrevious(): ZoomResult | null;
  zoomNext(): ZoomResult | null;

  // State
  getCurrentTransform(): ViewTransform;
  getHistory(): ZoomHistoryEntry[];
  clearHistory(): void;

  // Configuration
  setConfig(config: Partial<ZoomConfig>): void;
  getConfig(): ZoomConfig;
}