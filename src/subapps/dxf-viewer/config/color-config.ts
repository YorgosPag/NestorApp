/**
 * COLOR CONFIGURATION
 * Central configuration for all colors used across the DXF viewer
 * Eliminates hardcoded color values and ensures consistency
 */

// Core UI Colors (Base)
const UI_COLORS_BASE = {
  // Basic colors
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  TRANSPARENT: 'transparent',

  // UI Background Colors για fallbacks
  DARK_BACKGROUND: '#333333',
  DARKER: '#222222', // ✅ ENTERPRISE: Even darker background for UI elements
  LIGHT_GRAY: '#cccccc',
  MEDIUM_GRAY: '#888888',
  LIGHT_GRAY_ALT: '#bbbbbb',
  BLUE_DEFAULT: '#4444ff',

  // Ruler colors
  RULER_NEUTRAL_GRAY: '#f0f0f0',
  RULER_DARK_GRAY: '#666666',
  RULER_LIGHT_GRAY: '#999999',
  RULER_TEXT_GRAY: '#333333',

  // Text labeling colors
  TEXT_LABEL_BORDER: '#333333',
  TEXT_LABEL_BG_FALLBACK: 'rgba(30, 41, 59, 0.9)',

  // Scrollbar colors
  SCROLLBAR_GRAY: '#cbd5e1',
  SCROLLBAR_GRAY_HOVER: '#94a3b8',

  // Toolbar colors
  TOOLBAR_BG: '#f8f9fa',
  TOOLBAR_BORDER: '#dee2e6',
  TOOLBAR_TEXT: '#212529',
  TOOLBAR_HOVER: '#e9ecef',
  TOOLBAR_ACTIVE: '#007bff',
  TOOLBAR_DISABLED: '#6c757d',

  // Collaboration colors
  COLLAB_USER_1: '#FF6B6B',  // Red
  COLLAB_USER_2: '#4ECDC4',  // Teal
  COLLAB_USER_3: '#45B7D1',  // Blue
  COLLAB_USER_4: '#FFA07A',  // Light salmon
  COLLAB_USER_5: '#98D8C8',  // Mint green
  COLLAB_USER_6: '#F7DC6F',  // Yellow
  COLLAB_USER_7: '#BB8FCE',  // Purple
  COLLAB_USER_8: '#85C1E2',  // Light blue

  // Grid colors
  GRID_BLUE: '#4444ff',
  GRID_AXES_GRAY: '#666666',

  // Indicators
  INDICATOR_BLUE: '#0099ff',
  
  // Entity colors
  DEFAULT_ENTITY: '#FFFFFF',
  SELECTED_ENTITY: '#ffffff',
  HOVERED_ENTITY: '#ffffff',
  HIGHLIGHTED_ENTITY: '#FF3B30',
  
  // Drawing colors
  DRAWING_LINE: '#FFFFFF',
  DRAWING_PREVIEW: '#00ff80',
  DRAWING_TEMP: '#ffaa00',
  DRAWING_HIGHLIGHT: '#ff6600', // Orange highlight για DxfRenderer

  // Critical canvas rendering colors (από log analysis)
  SELECTED_RED: '#ff0000',      // Red για selected polygons/entities
  BRIGHT_GREEN: '#00ff00',      // Bright green για measurements/previews
  BRIGHT_YELLOW: '#ffff00',     // Bright yellow για warnings/highlights
  CANVAS_STROKE_DEFAULT: '#ffffff', // Default stroke color for canvas
  OVERLAY_RED: '#ff6b6b',       // Red για overlays
  
  // Measurement colors
  MEASUREMENT_TEXT: '#00ff00',
  MEASUREMENT_LINE: '#00ff00',
  MEASUREMENT_POINTS: '#ffffff',
  DISTANCE_TEXT: '#00ff00',
  
  // Grip colors
  GRIP_DEFAULT: '#00ff80',
  GRIP_HOVER: '#ffffff',
  GRIP_SELECTED: '#ffffff',
  GRIP_OUTLINE: '#000000',
  
  // Snap indicator colors
  SNAP_MIDPOINT: '#00ff00',      // Green for midpoints
  SNAP_ENDPOINT: '#ff0000',      // Red for endpoints
  SNAP_INTERSECTION: '#ff00ff',  // Magenta for intersections
  SNAP_PERPENDICULAR: '#9B59B6',
  SNAP_CENTER: '#0000ff',        // Blue for centers
  SNAP_DEFAULT: '#ffff00',       // Yellow default
  SNAP_HIGHLIGHT: '#ffffff',     // White highlight
  
  // Thermal/Phase colors
  THERMAL_COLD: '#ffffff',
  THERMAL_WARM: '#ffffff',
  THERMAL_HOT: '#FF3B30',
  THERMAL_CONTOUR: '#000000',
  
  // Selection colors
  SELECTION_HIGHLIGHT: '#ffffff',
  SELECTION_MARQUEE: '#3b82f6',
  SELECTION_LASSO: '#3b82f6',
  SELECTION_RED: '#ff4444',
  
  // UI Element colors
  BUTTON_PRIMARY: '#3b82f6',
  BUTTON_PRIMARY_HOVER: '#2563eb',
  BUTTON_SECONDARY: '#6b7280',
  BUTTON_SECONDARY_HOVER: '#4b5563',

  // Status Indicator colors
  STATUS_GENERAL_ACTIVE: '#3B82F6',    // Blue for general settings active
  STATUS_SPECIFIC_ACTIVE: '#22C55E',   // Green for specific settings active
  STATUS_INACTIVE: '#6B7280',          // Gray for inactive states

  // Focus ring colors
  FOCUS_RING: 'rgba(59, 130, 246, 0.5)', // Primary focus ring

  // Box shadow colors
  SHADOW_LIGHT: 'rgba(0, 0, 0, 0.05)',   // Light shadow (shadow-sm)
  SHADOW_MEDIUM: 'rgba(0, 0, 0, 0.1)',   // Medium shadow (shadow-md)
  SHADOW_HEAVY: 'rgba(0, 0, 0, 0.2)',    // Heavy shadow (shadow-lg)
  SHADOW_XL: 'rgba(0, 0, 0, 0.25)',      // Extra large shadow (shadow-xl)

  // Modal overlay colors
  MODAL_OVERLAY_LIGHT: 'rgba(0, 0, 0, 0.5)',     // Base modal backdrop
  MODAL_OVERLAY_MEDIUM: 'rgba(0, 0, 0, 0.75)',   // Import modal backdrop
  MODAL_OVERLAY_HEAVY: 'rgba(0, 0, 0, 0.8)',     // Cursor tooltip backdrop
  MODAL_OVERLAY_CRITICAL: 'rgba(0, 0, 0, 0.9)',  // Critical modal backdrop

  // Selection overlay colors
  SELECTION_MARQUEE_BG: 'rgba(0, 122, 204, 0.1)', // Selection rectangle background

  // Custom Upload Area Color (Enterprise Dark Blue-Gray)
  UPLOAD_AREA_BG: 'rgb(43, 59, 85)',
  UPLOAD_AREA_BG_HOVER: 'rgb(55, 73, 99)',
  UPLOAD_AREA_BORDER: 'rgb(75, 91, 115)',
  
  // Status colors
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',

  // Additional status colors for property-status-enterprise
  DARK_RED: '#dc2626',       // Rented status
  LIGHT_ORANGE: '#fbbf24',   // Under negotiation
  LIGHT_PURPLE: '#a855f7',   // Coming soon
  LIGHT_GRAY_OFF_MARKET: '#9ca3af',     // Off market - enterprise status color
  DARK_GRAY: '#6b7280',      // Unavailable

  // Constraint system colors (για compatibility με constraints/config.ts)
  YELLOW: '#FFFF00',         // Polar constraints
  ORANGE: '#ffaa00',         // Distance constraints
  PURPLE: '#9c27b0',         // Parallel constraints
  MAGENTA: '#FF00FF',        // Perpendicular constraints
  GREEN: '#22c55e',          // Ortho constraints
  RED: '#ef4444',            // Error/critical constraints

  // Test colors
  CUSTOM_TEST_COLOR: '#123456',  // For unit tests

  // Grid Colors
  GRID_MAJOR: '#888888',        // Major grid lines
  GRID_MINOR: '#bbbbbb',        // Minor grid lines

  // Debug & Development Colors
  DEBUG_CURSOR: '#0066FF',      // Blue for cursor debug markers
  SUCCESS_GREEN: '#22c55e',     // Green for overlay success
  SUCCESS_BRIGHT: '#00ff80',    // Bright green for edge grips
  SEMI_TRANSPARENT_RED: '#ff000080', // Semi-transparent red for fills
  DEBUG_CROSSHAIR: '#00FF00',   // Green for crosshair debug
  DEBUG_SNAP: '#FF0000',        // Red for snap debug
  DEBUG_DISTANCE: '#FFAA00',    // Orange for distance measurements
  DEBUG_ORIGIN: '#FF00FF',      // Magenta for origin markers
  DEBUG_RULER: '#00FFFF',       // Cyan for ruler debug
  DEBUG_GRID: '#FFFFFF',        // White for grid debug

  // Ruler Debug Colors
  RULER_MAJOR_TICK: '#FF0000',  // Red for major ticks
  RULER_MINOR_TICK: '#00FF00',  // Green for minor ticks
  RULER_CALIBRATION: '#00FFFF', // Cyan for calibration grid
  RULER_ORIGIN_MARKER: '#FF00FF', // Magenta for origin

  // Settings & Test Colors
  TEST_LINE_COLOR: '#FFFFFF',   // White for test line colors
  TEST_TEXT_COLOR: '#FFFFFF',   // White for test text
  TEST_GRIP_BLUE: '#0000FF',    // Blue for test grips
  TEST_GRIP_HOVER: '#00FFFF',   // Cyan for test grip hover
  TEST_DRAFT_GRAY: '#808080',   // Gray for draft mode
  TEST_PREVIEW_RED: '#FF0000',  // Red for preview mode

  // Overlay & Rendering Colors
  OVERLAY_SELECTION: '#00ff00',  // Green for selection
  OVERLAY_HOVER: '#ffff00',     // Yellow for hover
  OVERLAY_SNAP_POINT: '#ff00ff', // Magenta for snap points
  OVERLAY_GRIP_HOT: '#ff0000',  // Red for hot grips
  OVERLAY_GRIP_COLD: '#0000ff', // Blue for cold grips
  OVERLAY_AXIS_X: '#ff0000',    // Red for X axis
  OVERLAY_AXIS_Y: '#00ff00',    // Green for Y axis
  OVERLAY_ORIGIN: '#0000ff',    // Blue for origin
} as const;

// ✅ ENTERPRISE FIX: Export UI_COLORS moved after CAD_UI_COLORS and LEGACY_COLORS

// Opacity variations
export const OPACITY = {
  OPAQUE: 1.0,
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.5,
  VERY_LOW: 0.3,
  FAINT: 0.1,
} as const;

// Color utility functions
export const withOpacity = (color: string, opacity: number): string => {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return `${color}${alpha}`;
  }
  
  // Handle rgb colors
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  }
  
  // Handle rgba colors
  if (color.startsWith('rgba(')) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${opacity})`);
  }
  
  return color;
};

export const getContrastColor = (backgroundColor: string): string => {
  // Simple contrast calculation - can be enhanced
  const isLight = backgroundColor === UI_COLORS_BASE.WHITE ||
                  backgroundColor.includes('fff') ||
                  backgroundColor.includes('FFF');
  return isLight ? UI_COLORS_BASE.BLACK : UI_COLORS_BASE.WHITE;
};

// Predefined color schemes
export const COLOR_SCHEMES = {
  DEFAULT: {
    background: UI_COLORS_BASE.BLACK,
    foreground: UI_COLORS_BASE.WHITE,
    accent: UI_COLORS_BASE.BUTTON_PRIMARY,
  },
  
  CAD_CLASSIC: {
    background: UI_COLORS_BASE.BLACK,
    foreground: UI_COLORS_BASE.WHITE,
    accent: UI_COLORS_BASE.SNAP_DEFAULT,
  },

  HIGH_CONTRAST: {
    background: UI_COLORS_BASE.BLACK,
    foreground: UI_COLORS_BASE.WHITE,
    accent: UI_COLORS_BASE.WARNING,
  }
} as const;

// UI Palette Colors (from layers/constants/colors.ts)
export const SIMPLE_COLORS = [
  // Neutrals (5 colors) - Much more distinct from white to black
  '#ffffff', '#ffffff', '#ffffff', '#444444', '#000000',
  
  // Reds (5 colors) - Spaced out more
  '#ffcdd2', '#f44336', '#d32f2f', '#b71c1c', '#660000',
  
  // Pinks (5 colors) - Distinct pink variations
  '#f8bbd9', '#e91e63', '#c2185b', '#880e4f', '#4a0e2f',
  
  // Oranges (5 colors) - Well spaced oranges
  '#ffe0b2', '#ff9800', '#f57c00', '#e65100', '#b33a00',
  
  // Greens (5 colors) - CHANGED FROM YELLOWS για εξάλειψη κίτρινων grips
  '#c8e6c9', '#ffffff', '#4caf50', '#388e3c', '#2e7d32',
  
  // Greens (5 colors) - Nature greens with good spacing
  '#c8e6c9', '#4caf50', '#388e3c', '#2e7d32', '#1b5e20',
  
  // Teals/Cyans (5 colors) - Ocean blues-greens
  '#b2dfdb', '#00bcd4', '#0097a7', '#00695c', '#003d35',
  
  // Blues (5 colors) - Sky to navy progression
  '#bbdefb', '#2196f3', '#1976d2', '#0d47a1', '#063a6b',
  
  // Purples (5 colors) - Lavender to deep purple
  '#d1c4e9', '#9c27b0', '#7b1fa2', '#4a148c', '#2d0a5e'
] as const;

// CAD UI Colors (from cadUiConfig.ts)
export const CAD_UI_COLORS = {
  // Grips configuration (for vertices, midpoints, etc.)
  grips: {
    size_px: 6,
    color_unselected: '#0080ff', // Blue for unselected grips
    color_selected: '#ff0000',   // Red for selected grips
    color_hot: '#ff8000',        // Orange for hovered grips (hot)
    outline_color: '#ffffff',
    outline_width: 1,
    // ✅ AutoCAD standard grip colors for consistency with international standards
    cold: '#0000FF',     // ✅ AutoCAD standard: Blue (ACI 5) - unselected grips
    warm: '#FF69B4',     // ✅ AutoCAD standard: Hot Pink - hover grips
    hot: '#FF0000',      // ✅ AutoCAD standard: Red (ACI 1) - selected grips
  },
  
  // Entity configuration (for lines, circles, etc.)
  entity: {
    default: '#ffffff',    // White for normal entities
    hover: '#ffffff',      // White for hovered entities (with dashed line)
    selected: '#ffffff',   // White for selected entities
    preview: '#00ff00',    // Green for preview/drawing entities
  },
  
  // Pickbox configuration (the square in the middle of the cursor)
  pickbox: {
    size_px: 6,
    color: 'transparent',
    outline_color: '#ffffff',
    outline_width: 1,
  }
} as const;

// DXF Layer Colors (from dxf-scene-builder.ts)
export const DXF_LAYER_COLORS = [
  '#ffffff', '#ff6b6b', '#4ecdc4', '#45b7d1', 
  '#96ceb4', '#ffc93c', '#c44569'
] as const;

// Canvas Status Colors (from overlay-constants.ts)
export const CANVAS_STATUS_COLORS = {
  'for-sale':   '#22c55e', // Green
  'for-rent':   '#3b82f6', // Blue
  'reserved':   '#f59e0b', // Orange
  'sold':       '#ef4444', // Red
  'landowner':  '#8b5cf6', // Purple
} as const;

// Default Layer Color Constant
export const DEFAULT_LAYER_COLOR = '#ffffff' as const;

// DXF Layer Color Assignment Function
export const getLayerColor = (layerName: string): string => {
  const hash = layerName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return DXF_LAYER_COLORS[hash % DXF_LAYER_COLORS.length];
};

// Legacy color mappings for backward compatibility
export const LEGACY_COLORS = {
  // Common legacy names
  GREEN: UI_COLORS_BASE.MEASUREMENT_TEXT,
  YELLOW: '#FFFF00', // CHANGED πίσω σε κίτρινο
  BLUE: '#0000FF', // Blue for test cases
  WHITE: UI_COLORS_BASE.WHITE,
  BLACK: UI_COLORS_BASE.BLACK,
  ORANGE: UI_COLORS_BASE.DRAWING_TEMP,
  MAGENTA: '#FF00FF', // Magenta for test cases
} as const;

// ✅ ENTERPRISE FIX: Export UI_COLORS with CAD_UI_COLORS and LEGACY_COLORS included
export const UI_COLORS = {
  ...UI_COLORS_BASE,
  CAD_UI_COLORS,
  LEGACY_COLORS
} as const;

// ============================================================================
// UI GRADIENTS SYSTEM - Enterprise Color Picker Gradients
// ============================================================================

/**
 * Enterprise-grade CSS gradients για color picker components
 * Fortune 500 standards για brand consistency και theming support
 */
export const UI_GRADIENTS = {
  // Color Picker Gradients
  HUE_SPECTRUM: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',

  // Alpha transparency patterns
  ALPHA_CHECKERBOARD: `
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%)
  `,

  // Dynamic gradients (functions για runtime values)
  ALPHA_FADE: (color: string) => `linear-gradient(to right, transparent, ${color})`,
  SATURATION_FADE: (color: string) => `linear-gradient(to right, #808080, ${color})`,
  BRIGHTNESS_FADE: (color: string) => `linear-gradient(to right, #000000, ${color}, #ffffff)`,
  LIGHTNESS_FADE: (color: string) => `linear-gradient(to right, #000000, ${color}, #ffffff)`,

  // Individual RGB channel gradients
  RED_CHANNEL: 'linear-gradient(to right, #000000, #ff0000)',
  GREEN_CHANNEL: 'linear-gradient(to right, #000000, #00ff00)',
  BLUE_CHANNEL: 'linear-gradient(to right, #000000, #0000ff)',
} as const;