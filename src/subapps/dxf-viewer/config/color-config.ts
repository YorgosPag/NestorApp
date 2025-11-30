/**
 * COLOR CONFIGURATION
 * Central configuration for all colors used across the DXF viewer
 * Eliminates hardcoded color values and ensures consistency
 */

// Core UI Colors
export const UI_COLORS = {
  // Basic colors
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  TRANSPARENT: 'transparent',
  
  // Entity colors
  DEFAULT_ENTITY: '#FFFFFF',
  SELECTED_ENTITY: '#ffffff',
  HOVERED_ENTITY: '#ffffff',
  HIGHLIGHTED_ENTITY: '#FF3B30',
  
  // Drawing colors
  DRAWING_LINE: '#FFFFFF',
  DRAWING_PREVIEW: '#00ff80',
  DRAWING_TEMP: '#ffaa00',
  
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
  SNAP_MIDPOINT: '#ffffff',
  SNAP_ENDPOINT: '#00E5FF',
  SNAP_INTERSECTION: '#FF6B35',
  SNAP_PERPENDICULAR: '#9B59B6',
  SNAP_CENTER: '#E67E22',
  SNAP_DEFAULT: '#ffffff',
  
  // Thermal/Phase colors
  THERMAL_COLD: '#ffffff',
  THERMAL_WARM: '#ffffff',
  THERMAL_HOT: '#FF3B30',
  THERMAL_CONTOUR: '#000000',
  
  // Selection colors
  SELECTION_HIGHLIGHT: '#ffffff',
  SELECTION_MARQUEE: '#3b82f6',
  SELECTION_LASSO: '#3b82f6',
  
  // UI Element colors
  BUTTON_PRIMARY: '#3b82f6',
  BUTTON_PRIMARY_HOVER: '#2563eb',
  BUTTON_SECONDARY: '#6b7280',
  BUTTON_SECONDARY_HOVER: '#4b5563',

  // Custom Upload Area Color (Enterprise Dark Blue-Gray)
  UPLOAD_AREA_BG: 'rgb(43, 59, 85)',
  UPLOAD_AREA_BG_HOVER: 'rgb(55, 73, 99)',
  UPLOAD_AREA_BORDER: 'rgb(75, 91, 115)',
  
  // Status colors
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',
} as const;

// Opacity variations
export const OPACITY = {
  FULL: 1.0,
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
  const isLight = backgroundColor === UI_COLORS.WHITE || 
                  backgroundColor.includes('fff') ||
                  backgroundColor.includes('FFF');
  return isLight ? UI_COLORS.BLACK : UI_COLORS.WHITE;
};

// Predefined color schemes
export const COLOR_SCHEMES = {
  DEFAULT: {
    background: UI_COLORS.BLACK,
    foreground: UI_COLORS.WHITE,
    accent: UI_COLORS.BUTTON_PRIMARY,
  },
  
  CAD_CLASSIC: {
    background: UI_COLORS.BLACK,
    foreground: UI_COLORS.WHITE,
    accent: UI_COLORS.SNAP_DEFAULT,
  },
  
  HIGH_CONTRAST: {
    background: UI_COLORS.BLACK,
    foreground: UI_COLORS.WHITE,
    accent: UI_COLORS.WARNING,
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
  GREEN: UI_COLORS.MEASUREMENT_TEXT,
  YELLOW: '#FFFF00', // CHANGED πίσω σε κίτρινο
  BLUE: UI_COLORS.SELECTED_ENTITY,
  WHITE: UI_COLORS.WHITE,
  BLACK: UI_COLORS.BLACK,
  ORANGE: UI_COLORS.DRAWING_TEMP,
} as const;