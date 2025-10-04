/**
 * ZOOM SYSTEM CONFIGURATION
 * Configuration and types for zoom functionality
 */

// Re-export zoom window types
export type { ZoomWindowState } from '../../hooks/useZoomWindow';

// Zoom configuration interface
export interface ZoomConfig {
  minZoom: number;
  maxZoom: number;
  initialZoom: number;
  zoomStep: number;
  zoomInFactor: number;
  zoomOutFactor: number;
  smoothZoom: boolean;
  fitPadding: number;
  wheelZoomSpeed: number;
  keyboardZoomSpeed: number;
}

export const DEFAULT_ZOOM_CONFIG: ZoomConfig = {
  minZoom: 0.01,     // 1% minimum zoom
  maxZoom: 1000,     // 100,000% maximum zoom
  initialZoom: 1.0,  // 100% initial zoom
  zoomStep: 0.1,     // 10% step for gradual zoom
  zoomInFactor: 1.25, // 25% increase for zoom in
  zoomOutFactor: 0.8, // 20% decrease for zoom out
  smoothZoom: true,   // Enable smooth zoom animations
  fitPadding: 0.1,   // 10% padding for fit-to-view
  wheelZoomSpeed: 0.2, // Mouse wheel zoom sensitivity
  keyboardZoomSpeed: 0.15, // Keyboard zoom sensitivity
};

// Zoom window configuration
export interface ZoomWindowConfig {
  enabled: boolean;
  minSize: number;
  maxSize: number;
  showInstructions: boolean;
  showSizeIndicator: boolean;
  previewOpacity: number;
  borderColor: string;
  backgroundColor: string;
}

export const DEFAULT_ZOOM_WINDOW_CONFIG: ZoomWindowConfig = {
  enabled: true,
  minSize: 10,          // Minimum selection size in pixels
  maxSize: Infinity,    // Maximum selection size
  showInstructions: true,
  showSizeIndicator: true,
  previewOpacity: 0.2,  // 20% opacity for preview
  borderColor: '#3b82f6', // Blue border
  backgroundColor: '#3b82f6', // Blue background
};

// Zoom limits by zoom level
export interface ZoomLimits {
  veryFine: number;    // For very detailed work
  fine: number;        // For detailed work
  normal: number;      // Normal working zoom
  overview: number;    // For overview
  farOverview: number; // For far overview
}

export const ZOOM_PRESETS: ZoomLimits = {
  veryFine: 10.0,      // 1000%
  fine: 5.0,           // 500%
  normal: 1.0,         // 100%
  overview: 0.25,      // 25%
  farOverview: 0.1,    // 10%
};

// Zoom keyboard shortcuts
export interface ZoomShortcuts {
  zoomIn: string[];
  zoomOut: string[];
  fitToView: string[];
  resetZoom: string[];
  zoomWindow: string[];
  zoomToSelection: string[];
}

export const DEFAULT_ZOOM_SHORTCUTS: ZoomShortcuts = {
  zoomIn: ['+', '=', 'NumpadAdd'],
  zoomOut: ['-', '_', 'NumpadSubtract'],
  fitToView: ['f', 'F'],
  resetZoom: ['0', 'Numpad0'],
  zoomWindow: ['w', 'W'],
  zoomToSelection: ['s', 'S'],
};

// Zoom animation configuration
export interface ZoomAnimationConfig {
  enabled: boolean;
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  fps: number;
}

export const DEFAULT_ZOOM_ANIMATION_CONFIG: ZoomAnimationConfig = {
  enabled: true,
  duration: 300,        // 300ms animation
  easing: 'ease-out',
  fps: 60,              // 60 FPS
};

// Zoom feedback configuration
export interface ZoomFeedbackConfig {
  showZoomLevel: boolean;
  showZoomPercentage: boolean;
  showZoomIndicator: boolean;
  indicatorDuration: number;
  indicatorPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const DEFAULT_ZOOM_FEEDBACK_CONFIG: ZoomFeedbackConfig = {
  showZoomLevel: true,
  showZoomPercentage: true,
  showZoomIndicator: true,
  indicatorDuration: 2000, // 2 seconds
  indicatorPosition: 'top-right',
};

// Complete zoom system configuration
export interface ZoomSystemConfig {
  zoom: ZoomConfig;
  zoomWindow: ZoomWindowConfig;
  shortcuts: ZoomShortcuts;
  animation: ZoomAnimationConfig;
  feedback: ZoomFeedbackConfig;
}

export const DEFAULT_ZOOM_SYSTEM_CONFIG: ZoomSystemConfig = {
  zoom: DEFAULT_ZOOM_CONFIG,
  zoomWindow: DEFAULT_ZOOM_WINDOW_CONFIG,
  shortcuts: DEFAULT_ZOOM_SHORTCUTS,
  animation: DEFAULT_ZOOM_ANIMATION_CONFIG,
  feedback: DEFAULT_ZOOM_FEEDBACK_CONFIG,
};