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
  CANVAS_BACKGROUND: '#000000', // ✅ ENTERPRISE: Pure black like AutoCAD for maximum color contrast
  CANVAS_BACKGROUND_AUTOCAD_DARK: '#1a1a1a', // ✅ ENTERPRISE: AutoCAD dark canvas background
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
  ENTITY_HOVER_GLOW: '#FFFF00',  // AutoCAD-style yellow glow on crosshair hover
  HIGHLIGHTED_ENTITY: '#FF3B30',
  
  // Drawing colors
  DRAWING_LINE: '#FFFFFF',
  DRAWING_PREVIEW: '#00ff80',
  DRAWING_TEMP: '#ffaa00',
  DRAWING_HIGHLIGHT: '#ff6600', // Orange highlight για DxfRenderer

  // Preview/Drawing Colors (ADR-123)
  PREVIEW_ARC_ORANGE: '#FFA500', // Arc stroke in angle measurement

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
  GRIP_HOVER: '#f59e0b',        // Orange for hover state (Autodesk pattern)
  GRIP_SELECTED: '#ffffff',
  GRIP_OUTLINE: '#000000',
  GRIP_EDGE: '#9ca3af',         // 🏢 ENTERPRISE: Gray for edge midpoint grips (Autodesk pattern)
  
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
  FOCUS_RING: 'rgba(59, 130, 246, 0.5)', // Primary focus ring (50% opacity)

  // Primary color RGBA variants (ADR-115: Primary Blue Centralization)
  PRIMARY_FILL_20: 'rgba(59, 130, 246, 0.2)', // Focus ring shadow (20% opacity)
  PRIMARY_FILL_30: 'rgba(59, 130, 246, 0.3)', // Fill background (30% opacity)

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

  // 🏢 ENTERPRISE (2027-01-27): Measurement Text Colors - ADR-048 Hardcoded Values Centralization
  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Δύο ξεχωριστές σταθερές για αυτονομία χρωμάτων
  ANGLE_MEASUREMENT_TEXT: 'fuchsia',   // Φούξια για μέτρηση γωνιών (μοίρες, radians)
  DISTANCE_MEASUREMENT_TEXT: '#FFFFFF', // Λευκό για μέτρηση μηκών ευθύγραμμων τμημάτων

  // 🔄 LEGACY ALIAS - για backward compatibility
  DIMENSION_TEXT: 'fuchsia',    // @deprecated - χρησιμοποίησε ANGLE_MEASUREMENT_TEXT ή DISTANCE_MEASUREMENT_TEXT
} as const;

// ✅ ENTERPRISE FIX: Export UI_COLORS moved after CAD_UI_COLORS and LEGACY_COLORS

// Opacity variations
// 🏢 ADR-119: Centralized Canvas globalAlpha Opacity Values
// 🏢 ADR-134: Extended Opacity Values - Complete opacity spectrum
export const OPACITY = {
  OPAQUE: 1.0,        // Full opacity - no transparency
  VERY_HIGH: 0.95,    // 🏢 ADR-134: Near-opaque (electrical cables, critical elements)
  HIGH: 0.9,          // Snap indicators, preview lines
  MEDIUM_HIGH: 0.85,  // 🏢 ADR-134: Constraints, furniture lines
  MEDIUM: 0.8,        // 🏢 ADR-134: Selection, cursor, axes (was 0.7)
  MEDIUM_LOW: 0.7,    // 🏢 ADR-134: Regions, secondary elements
  SUBTLE: 0.6,        // 🏢 ADR-119: For origin markers, subtle overlays
  LOW: 0.5,           // PDF backgrounds, disabled states
  DISABLED: 0.4,      // 🏢 ADR-134: Disabled menu items
  VERY_LOW: 0.3,      // Grid opacity
  FAINT: 0.1,         // Barely visible elements
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
// CANVAS THEME SYSTEM - Enterprise Canvas Background Management (ADR-004)
// ============================================================================
//
// 🏢 WORLD-CLASS ENTERPRISE STANDARD (Figma/AutoCAD/Blender Level)
// 📍 SOURCE: design-tokens.json → build-design-tokens.js → CSS Variables
// 🚫 PROHIBITION: ΜΗΝ ορίζετε canvas backgrounds αλλού (π.χ. panel-tokens.ts)
//
// ΑΡΧΙΤΕΚΤΟΝΙΚΗ:
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ design-tokens.json → build-design-tokens.js → variables.css → Runtime   │
// │                                                                          │
// │ 🎯 CSS Variables enable:                                                 │
// │    ✅ Runtime theme switching                                            │
// │    ✅ User preferences (dark/light/custom)                               │
// │    ✅ DevTools live editing                                              │
// │    ✅ Zero-rebuild theme changes                                         │
// └──────────────────────────────────────────────────────────────────────────┘
//
// ΙΕΡΑΡΧΙΑ CANVAS LAYERS:
// ┌────────────────────────────────────────────────────────────────┐
// │ Layer 5: Overlays (crosshair, grips, selection) - TRANSPARENT │
// │ Layer 4: UI Elements (rulers, toolbars) - TRANSPARENT         │
// │ Layer 3: LayerCanvas (color overlays) - TRANSPARENT           │
// │ Layer 2: DxfCanvasCore (DXF entities) - PURE BLACK #000000    │
// │ Layer 1: Container (parent div) - TRANSPARENT                 │
// └────────────────────────────────────────────────────────────────┘
//
// ============================================================================

/**
 * 🎨 CANVAS_THEME - Enterprise Canvas Background Configuration
 *
 * 🏢 WORLD-CLASS IMPLEMENTATION:
 * Χρησιμοποιεί CSS Variables από design-tokens.json για runtime flexibility.
 * Ακολουθεί τα standards της Figma, AutoCAD, Blender.
 *
 * @example
 * // ✅ ΣΩΣΤΟ - Χρήση CSS Variable μέσω CANVAS_THEME
 * style={{ backgroundColor: CANVAS_THEME.DXF_CANVAS }}
 * // Result: backgroundColor: 'var(--canvas-background-dxf)'
 *
 * // ❌ ΛΑΘΟΣ - Hardcoded τιμή
 * style={{ backgroundColor: '#000000' }}
 */
export const CANVAS_THEME = {
  /**
   * 🖤 DXF_CANVAS - Main DXF rendering canvas
   * CSS Variable: --canvas-background-dxf (#000000)
   * Χρησιμοποιείται στο: DxfCanvasCore.tsx, canvas-v2/DxfCanvas.tsx
   */
  DXF_CANVAS: 'var(--canvas-background-dxf)' as const,

  /**
   * 🔲 LAYER_CANVAS - Color overlay layer
   * CSS Variable: --canvas-background-layer (transparent)
   * Χρησιμοποιείται στο: LayerCanvas.tsx
   */
  LAYER_CANVAS: 'var(--canvas-background-layer)' as const,

  /**
   * 🔲 OVERLAY - UI overlays (crosshair, grips, selection)
   * CSS Variable: --canvas-background-overlay (transparent)
   * Χρησιμοποιείται στο: CrosshairOverlay, SelectionOverlay, etc.
   */
  OVERLAY: 'var(--canvas-background-overlay)' as const,

  /**
   * 🔲 CONTAINER - Parent container divs
   * CSS Variable: --canvas-background-container (transparent)
   * Χρησιμοποιείται στο: CanvasSection.tsx, canvas-stack
   */
  CONTAINER: 'var(--canvas-background-container)' as const,

  /**
   * 🎨 Alternative themes - CSS Variables για runtime switching
   * Χρήση: document.documentElement.style.setProperty('--canvas-background-dxf', CANVAS_THEME.THEMES.BLENDER)
   */
  THEMES: {
    /** AutoCAD Classic - Pure black */
    AUTOCAD_CLASSIC: 'var(--canvas-themes-autocad-classic)' as const,
    /** AutoCAD Dark Gray */
    AUTOCAD_DARK: 'var(--canvas-themes-autocad-dark)' as const,
    /** SolidWorks style - Dark blue-gray */
    SOLIDWORKS: 'var(--canvas-themes-solidworks)' as const,
    /** Blender style - Dark gray */
    BLENDER: 'var(--canvas-themes-blender)' as const,
    /** Light theme - For print preview */
    LIGHT: 'var(--canvas-themes-light)' as const,
  },
} as const;

// Type exports για TypeScript safety
export type CanvasThemeKey = keyof typeof CANVAS_THEME;
export type CanvasThemeValue = typeof CANVAS_THEME[CanvasThemeKey];

// ============================================================================
// 🏢 ADR-142: ICON CLICK SEQUENCE COLORS (2026-02-01)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Icon Click Sequence Colors
 *
 * Unified colors for tool icon click indicators.
 * Used across all drawing tool icons (Line, Circle, Arc, Angle).
 *
 * Pattern: Red → Orange → Green (1st → 2nd → 3rd click)
 *
 * @see LineIcon.tsx, CircleIcon.tsx, ArcIcon.tsx
 * @see AngleIconBase.tsx, AngleTwoArcsIcon.tsx
 * @see ADR-142: Icon Click Sequence Colors Centralization
 * @since 2026-02-01
 */
export const ICON_CLICK_COLORS = {
  /** 🔴 Red - 1st click (start point) */
  FIRST: '#ef4444',

  /** 🟠 Orange - 2nd click (intermediate point) */
  SECOND: '#f97316',

  /** 🟢 Green - 3rd/last click (end point/result) */
  THIRD: '#22c55e',

  /** Gray - Reference line (for perpendicular/parallel tools) */
  REFERENCE: '#9ca3af',
} as const;

export type IconClickColor = typeof ICON_CLICK_COLORS[keyof typeof ICON_CLICK_COLORS];

// ============================================================================
// 🏢 ADR-143: FOCUS RING & BUTTON HOVER COLORS (2026-02-01)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Focus Ring Shadow Colors
 *
 * Unified focus ring colors for button variants.
 * Used for box-shadow focus states across all dialogs.
 *
 * Pattern: 0 0 0 3px [color] (3px ring with 20% opacity)
 *
 * @see SimpleProjectDialog.styles.ts
 * @see ADR-143: Focus Ring Colors Centralization
 * @since 2026-02-01
 */
export const FOCUS_RING_SHADOWS = {
  /** Primary focus ring - blue @ 20% */
  PRIMARY: UI_COLORS_BASE.PRIMARY_FILL_20,

  /** Secondary focus ring - gray-600 @ 20% */
  SECONDARY: 'rgba(107, 114, 128, 0.2)',

  /** Success focus ring - green @ 20% */
  SUCCESS: 'rgba(16, 185, 129, 0.2)',

  /** Destructive focus ring - red @ 20% */
  DESTRUCTIVE: 'rgba(239, 68, 68, 0.2)',

  /** Warning focus ring - amber @ 20% */
  WARNING: 'rgba(245, 158, 11, 0.2)',
} as const;

/**
 * 🏢 ENTERPRISE: Button Hover Background Colors
 *
 * Hover state background colors for button variants.
 * Slightly darker than base colors for visual feedback.
 *
 * @see SimpleProjectDialog.styles.ts
 * @see ADR-143: Button Hover Colors Centralization
 * @since 2026-02-01
 */
export const BUTTON_HOVER_COLORS = {
  /** Success hover - green-600 */
  SUCCESS: '#059669',

  /** Destructive hover - red-600 */
  DESTRUCTIVE: '#DC2626',

  /** Warning hover - amber-600 */
  WARNING: '#D97706',
} as const;

/**
 * 🏢 ENTERPRISE: Form Border Colors
 *
 * Border colors for form elements (inputs, selects, etc.)
 *
 * @see SimpleProjectDialog.styles.ts
 * @since 2026-02-01
 */
export const FORM_BORDER_COLORS = {
  /** Default border - light gray */
  DEFAULT: '#cccccc',

  /** Focus border - primary blue */
  FOCUS: UI_COLORS_BASE.BUTTON_PRIMARY,
} as const;

export type FocusRingShadowKey = keyof typeof FOCUS_RING_SHADOWS;
export type ButtonHoverColorKey = keyof typeof BUTTON_HOVER_COLORS;

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

// ============================================================================
// 🏢 ADR-166: GHOST ENTITY COLORS (2026-02-01)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Ghost Entity Rendering Colors
 *
 * Colors for drag preview ghost entities.
 * Based on: AutoCAD drag preview, Figma selection ghost, Adobe Illustrator preview
 *
 * @see ghost-entity-renderer.ts
 * @since 2026-02-01
 */
export const GHOST_COLORS = {
  /** Ghost base color (blue) - #0078FF */
  BASE: '#0078FF',

  /** Ghost fill color (15% opacity) */
  FILL: 'rgba(0, 120, 255, 0.15)',

  /** Ghost stroke color (60% opacity) */
  STROKE: 'rgba(0, 120, 255, 0.6)',

  /** Delta line color (orange, 80% opacity) */
  DELTA_LINE: 'rgba(255, 165, 0, 0.8)',

  /** Coordinate readout text color */
  READOUT_TEXT: 'rgba(0, 0, 0, 0.8)',

  /** Coordinate readout background */
  READOUT_BG: 'rgba(255, 255, 255, 0.9)',

  /** Simplified box color for large selections (30% opacity) */
  SIMPLIFIED_BOX: 'rgba(0, 120, 255, 0.3)',
} as const;

export type GhostColorKey = keyof typeof GHOST_COLORS;
