/**
 * COLOR CONFIGURATION
 * Central configuration for all colors used across the DXF viewer
 * Eliminates hardcoded color values and ensures consistency
 */

// 🏢 Color-Conversion SSoT (ADR-573): the alpha-byte formatter lives in `color-math`
// (pure leaf, zero cycle). `withOpacity` composes it instead of an inline converter.
import { channelToHex, hexToRgba, mixHex } from './color-math';

// ============================================================================
// GRIP COLOR SSOT — single source for all 6 consumers
// Change here → changes everywhere (constants.ts, panel-tokens.ts,
// FACTORY_DEFAULTS.ts, types/gripSettings.ts, stores/GripStyleStore.ts, CAD_UI_COLORS)
// ============================================================================
export const GRIP_COLD_COLOR = '#007FFF' as const;  // Σιελ/azure — normal (cold). Distinct from snappable cyan #00BCD4 (Giorgio 2026-06-17)
export const GRIP_WARM_COLOR = '#ff00ff' as const;  // Magenta/ροζ — hover (warm). Giorgio 2026-07-07 (was orange #FF7F00); = UI_COLORS.SNAP_INTERSECTION
export const GRIP_HOT_COLOR  = '#FF0000' as const;  // Red    — active drag (hot)
// ADR-501 — «armed» grip state: a cold grip the user CLICKED to select for a multi-grip
// move (orange, Giorgio's request «να γίνονται πορτοκαλί»). A distinct orange identity,
// separate from the fleeting hover-warm (now magenta/ροζ #ff00ff), so a persistently-selected
// grip reads distinct from a momentary hover. Hot (#FF0000 red) stays reserved for active drag.
export const GRIP_ARMED_COLOR = '#FF6A00' as const; // Orange — armed/selected (multi-grip)
export const GRIP_CONTOUR_COLOR = '#000000' as const; // Black — outline
// ADR-397 — «snappable» grip state: a grip that is an active snap target during a
// rotation operation. Cyan (= UI_COLORS_BASE.GUIDE_X '#00BCD4', construction/guide
// family) so it reads as "snap reference", distinct from cold/warm/hot.
export const GRIP_SNAPPABLE_COLOR = '#00BCD4' as const; // Cyan — snappable-during-rotation
// ADR-637 Φ4-D — «rest-landing» (πλατύσκαλο) grip identity colour (Giorgio 2026-07-11 «φουξ»).
// A vivid FUCHSIA so the landing slide/length handles read as a distinct family among the
// stair grips. Deliberately NOT the warm magenta #ff00ff (hover) — a redder fuchsia so a
// STATIC landing grip never reads as a hovered one. Applied as a per-grip `customColor`.
export const GRIP_REST_LANDING_COLOR = '#E4007C' as const; // Fuchsia — stair rest-landing grips
// ADR-739 Φ.Γ — ταυτότητα των λαβών **πλάτους στήλης** πίνακα (Giorgio 2026-08-03: «ξεχώρισε
// το χρώμα των λαβών που αλλάζουν το πλάτος των στηλών»). Ίδιος μηχανισμός με το πλατύσκαλο
// (ADR-637): per-grip `customColor`, ΟΧΙ κανόνας type→χρώμα μέσα στον `GripColorManager` — ο
// ADR-048 v2.3 τον απαγορεύει ρητά, και το ελάττωμα που τον γέννησε ήταν ΑΚΡΙΒΩΣ σε αυτές τις
// λαβές («edge + cold → πράσινο» έβαφε ολόκληρη τη στήλη μέσω του αντιπροσώπου της παρτίδας).
//
// Η επιλογή της απόχρωσης δεν είναι γούστο — είναι **αποκλεισμός**: κατειλημμένα στο κανάλι
// λαβών είναι το σιέλ #007FFF (ηρεμία), το magenta #ff00ff (hover), το κόκκινο #FF0000 (σύρσιμο),
// το πορτοκαλί #FF6A00 (οπλισμένη), το κυανό #00BCD4 (στόχος έλξης) και το φούξια #E4007C
// (πλατύσκαλο)· το **πράσινο** αποκλείεται ξεχωριστά, γιατί στο AutoCAD σημαίνει hover και μια
// λαβή σε ηρεμία θα διαβαζόταν ως «είσαι πάνω της» (ο λόγος που αφαιρέθηκε το #00ff80).
// Μένει η **λεβάντα**: φωτεινή σε σκούρο καμβά, σαφώς μη-magenta.
export const GRIP_TABLE_COLUMN_EDGE_COLOR = '#B388FF' as const; // Lavender — λαβές πλάτους στήλης

/**
 * Οι λαβές **ύψους γραμμής** μοιράζονται το ΙΔΙΟ χρώμα με τις λαβές πλάτους στήλης — μία
 * σταθερά, όχι δύο (Giorgio 2026-08-04: «όπως υπάρχουν αντίστοιχα λαβές που ρυθμίζουν το
 * πλάτος των στηλών»).
 *
 * Το χρώμα δεν κωδικοποιεί **άξονα** — κωδικοποιεί **εμβέλεια**: «αυτή η λαβή αλλάζει ένα
 * κελί-πλάτος, όχι ολόκληρο τον πίνακα». Ο άξονας τον λέει ήδη η θέση (πάνω ακμή vs
 * αριστερή) και ο δείκτης (↔ vs ↕) — δύο κανάλια που δεν χρειάζονται τρίτο. Δεύτερο χρώμα
 * θα υπαινισσόταν διαφορά **είδους** που δεν υπάρχει.
 */
export const GRIP_TABLE_ROW_EDGE_COLOR = GRIP_TABLE_COLUMN_EDGE_COLOR;

/**
 * Resolved grip colors — all fields are non-null strings, ready for rendering.
 * Consumers that received GripColors (with nullable cold) should call
 * resolveGripColors() ONCE and then use this type exclusively.
 */
export interface ResolvedGripColors {
  cold: string;
  warm: string;
  hot: string;
  contour: string;
}

/**
 * Single resolution point for the grip cold null sentinel.
 * null cold means "use GRIP_COLD_COLOR SSoT" (Revit-style pattern).
 * Call this ONCE at the boundary between stored settings and runtime use.
 */
export function resolveGripColors(colors: {
  cold: string | null;
  warm: string;
  hot: string;
  contour: string;
}): ResolvedGripColors {
  return { ...colors, cold: colors.cold ?? GRIP_COLD_COLOR };
}

// Core UI Colors (Base)
export const UI_COLORS_BASE = {
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

  // ADR-189: Construction guide colors
  GUIDE_X: '#00BCD4',        // Cyan — vertical (X-axis) guides
  GUIDE_Z: '#FF6347',        // Tomato — horizontal (Y-axis) guides
  GUIDE_PARALLEL: '#9370DB', // Purple — parallel offset guides
  GUIDE_XZ: '#6366F1',       // Indigo — diagonal (XZ) guides

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
  
  // ADR-650 M8β/Γ — auto-breakline REVIEW colours (proposals under approval, never the survey).
  // One vocabulary read by all three surfaces that draw a proposal — the 2D preview overlay
  // (SVG), the 3D candidate layer (LineBasicMaterial) and the panel list (via the CSS module) —
  // because «πράσινη στο σχέδιο» in the panel's own text is a promise the 3D view must keep too.
  TOPO_BREAKLINE_APPROVED: '#22c55e', // ticked → will be written on «Προσθήκη»
  TOPO_BREAKLINE_REJECTED: '#94a3b8', // unticked → shown, but will be ignored

  // Selection colors
  SELECTION_HIGHLIGHT: '#ffffff',
  EDIT_EDGE_HIGHLIGHT: '#00b8d4',   // Cyan — η ακμή υπό επεξεργασία (per-edge edit· ADR-417 roof «Κλίση ανά νερό»)
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
  SUCCESS: '#2ce202',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',

  // Additional status colors for property-status-enterprise
  DARK_RED: '#dc2626',       // Rented status
  LIGHT_ORANGE: '#fbbf24',   // Under negotiation
  LIGHT_PURPLE: '#a855f7',   // Coming soon
  LIGHT_GRAY_OFF_MARKET: '#9ca3af',     // Off market - enterprise status color
  DARK_GRAY: '#6b7280',      // Unavailable
  TEAL: '#14b8a6',           // 🩵 For-sale-and-rent (ADR-258: Twin Architecture)

  // 🎨 Layer DRAFT colors — used when drawing OR for overlays not yet linked to an
  // entity. Distinct from every status color (no clash with for-rent blue / sold red /
  // for-sale green / reserved orange / for-sale-and-rent teal / landowner purple).
  LAYER_DRAFT_STROKE: '#ec4899',                    // Pink-500 — vivid, status-neutral
  LAYER_DRAFT_FILL:   'rgba(236, 72, 153, 0.3)',    // Pink-500 @ 30% — translucent fill

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
  // 🪜 ADR-681 §5.7 — the cascade promotes a level from minor to major as zoom
  // changes, so a wide minor/major gap makes that swap read as an event. C4D
  // keeps its two levels ~10/255 apart (major DARKER, emphasis from width);
  // we keep a larger gap because a 2D drafting grid is a measuring reference,
  // but narrowed 51 → 24 so the swap stops being a jump.
  GRID_MAJOR: '#989898',        // Major grid lines (darker; weight carries emphasis)
  GRID_MINOR: '#b0b0b0',        // Minor grid lines

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
  OVERLAY_GRIP_HOT: GRIP_HOT_COLOR,  // SSOT → GRIP_HOT_COLOR (red hot grips) — was '#ff0000'
  OVERLAY_GRIP_COLD: GRIP_COLD_COLOR, // SSOT → GRIP_COLD_COLOR
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

// 🏢 ADR-258: SSoT overlay opacity per rendering context (Twin Architecture)
// DXF Viewer: αχνό (δεν κρύβει αρχιτεκτονικές γραμμές)
// FloorplanGallery: έντονο (εμπορική κατάσταση κυριαρχεί)
export const OVERLAY_OPACITY = {
  /** DXF Viewer fill — αχνό, δεν κρύβει DXF γραμμές */
  DXF_FILL: 0.2,
  /** FloorplanGallery fill — εμπορική κατάσταση κυριαρχεί */
  GALLERY_FILL: 0.5,
  /** FloorplanGallery hover state */
  GALLERY_HOVER: 0.7,
  /** Unavailable / off-market / muted / unlinked */
  MUTED: 0.375,
} as const;

// Color utility functions
export const withOpacity = (color: string, opacity: number): string => {
  // Handle hex colors — append an 8-bit alpha byte (#rrggbb → #rrggbbAA).
  // 🏢 Color-Conversion SSoT (ADR-573): alpha byte via `color-math.channelToHex`.
  if (color.startsWith('#')) {
    return `${color}${channelToHex(opacity * 255)}`;
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
    color_unselected: GRIP_COLD_COLOR,  // SSOT → GRIP_COLD_COLOR
    color_selected: GRIP_HOT_COLOR,    // SSOT → GRIP_HOT_COLOR
    color_hot: GRIP_WARM_COLOR,        // SSOT → GRIP_WARM_COLOR (hover)
    outline_color: '#ffffff',
    outline_width: 1,
    cold: GRIP_COLD_COLOR,     // SSOT → GRIP_COLD_COLOR
    warm: GRIP_WARM_COLOR,     // SSOT → GRIP_WARM_COLOR
    hot: GRIP_HOT_COLOR,       // SSOT → GRIP_HOT_COLOR
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
// 🏢 ADR-515: SNAP MARKER PALETTE (type-specific, Revit-grade)
// ============================================================================
//
// Primitive palette SSoT για τα ΧΡΩΜΑΤΑ των συμβόλων έλξης (snap markers). Το
// semantic type→χρώμα mapping (ExtendedSnapType → token) + ο resolver ζουν στο
// `rendering/ui/snap/snap-visual-config.ts` — αυτό εδώ είναι ΜΟΝΟ η παλέτα.
//
// Reuse υπαρχόντων primitives όπου η τιμή ΚΑΙ το νόημα συμπίπτουν (HIGHLIGHTED_ENTITY,
// SNAP_INTERSECTION, GUIDE_X). Τα υπόλοιπα είναι snap-specific primitives (πρώτη χρήση).
//
// @see ADR-515 §4.1
export const SNAP_MARKER_COLORS = {
  ENDPOINT:         UI_COLORS_BASE.HIGHLIGHTED_ENTITY,   // #FF3B30 κόκκινο (reuse)
  MIDPOINT:         '#00e676',                            // πράσινο
  CENTER:           '#2196f3',                            // μπλε
  INTERSECTION:     UI_COLORS_BASE.MAGENTA,               // #FF00FF magenta (reuse)
  PERPENDICULAR:    UI_COLORS_BASE.YELLOW,                // #FFFF00 κίτρινο (reuse)
  TANGENT:          '#ff9100',                            // amber
  QUADRANT:         UI_COLORS_BASE.GUIDE_X,               // #00BCD4 teal (reuse)
  NEAREST:          '#9e9e9e',                            // γκρι
  EXTENSION:        '#b0bec5',                            // γκρι-μπλε
  NODE:             '#ffc107',                            // amber
  PARALLEL:         UI_COLORS_BASE.SNAP_PERPENDICULAR,    // #9B59B6 μωβ (reuse)
  CONSTRUCTION:     '#ff4081',                            // pink
  DIM:              '#ff6d00',                            // πορτοκαλί (ADR-378 Step 3 — προσωρινό, υπό αξιολόγηση· εναλλακτικά φουξ #FF00FF, βλ. σχήμα dim_line/dim_def_point για διάκριση από INTERSECTION magenta)
  // ADR-597 §unified-glyph (2026-07-05): BIM_CORNER/MIDPOINT/CENTER καταργήθηκαν ως ξεχωριστά
  // χρώματα — μια BIM γωνία/μέσο/κέντρο είναι το ΙΔΙΟ ΕΙΔΟΣ σημείου με το γεωμετρικό
  // endpoint/midpoint/center και μοιράζεται το ΙΔΙΟ χρώμα (βλ. SNAP_COLORS στο snap-visual-config).
  BIM_WALL_FACE:    '#80d8ff',                            // αν. κυανό
  BIM_MEP_CONNECTOR:'#e040fb',                            // purple-pink
  TEXT:             '#ffd740',                            // χρυσό
  ROTATION:         '#ff6e40',                            // βαθύ πορτοκαλί
  /** Base / fallback marker colour (κυανό — κρατά το 3D marker στο ιστορικό cyan). */
  BASE:             '#00e5ff',
} as const;

// ============================================================================
// 🏢 ADR-571: CONSTRUCTION / MEP / TOOL CYAN SSoT
// ============================================================================
//
// Single source of truth για τα σημασιολογικά ΚΥΑΝΑ/TEAL χρώματα που παλιότερα
// ήταν hardcoded ως inline literals σε renderers, ghosts, tool-previews & 3D
// handles. Κάθε const = ΕΝΑ νόημα, ΜΙΑ αναπαράσταση (**μόνο hex**). Τα translucent
// fills παράγονται με `hexToRgba(hex, alpha)` (config/color-math.ts) και τα 3D
// numerics με `hexToTrueColor(hex)` (utils/dxf-true-color.ts) — ΚΑΝΕΝΑ ξεχωριστό
// rgb-tuple/helper εδώ (θα ήταν δεύτερη αναπαράσταση που ξεφεύγει).
//
// @see ADR-571
export const MEP_WATER_COLOR = '#0891b2' as const;       // cyan-teal — plumbing/νερό stroke + equipment fill (pipe/manifold/water-proposal + 3D material)
export const MEP_WATER_GHOST_FILL = '#22d3ee' as const;  // ανοιχτό κυανό — ghost/proposal fill (segment ghost, cold-water proposal)
export const MEP_TEAL_COLOR = '#0d9488' as const;        // teal — electrical panel + thermal space + HVAC return-air (stroke + fill)
// == value με SNAP_MARKER_COLORS.BASE ('#00e5ff'), αλλά ΞΕΧΩΡΙΣΤΟ νόημα: highlight
// «κλειδωμένου/anchor» στοιχείου & cut-indicator σε tool previews (structural + 3D wire).
export const TOOL_ANCHOR_CYAN = '#00E5FF' as const;
export const LASSO_STROKE_CYAN = '#0e7490' as const;     // dark cyan — freehand lasso path/ring/dot
export const GIZMO_ENDPOINT_TEAL = '#16b8c0' as const;   // teal — 3D gizmo endpoint control ring

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
    /** Cinema 4D — neutral grey solid base, paired with a vertical studio gradient (ADR-446 §2.1) */
    CINEMA4D: 'var(--canvas-themes-cinema4d)' as const,
  },
} as const;

// Type exports για TypeScript safety
export type CanvasThemeKey = keyof typeof CANVAS_THEME;
export type CanvasThemeValue = typeof CANVAS_THEME[CanvasThemeKey];

/**
 * SSoT primitive — read a CSS custom property from `:root` (trimmed). Returns `fallback`
 * off-DOM (SSR / tests / workers) or when the variable is unset/empty. The SINGLE place that
 * touches `getComputedStyle(documentElement).getPropertyValue` for theme tokens, so every
 * theme-colour resolver below — and external consumers (e.g. `axis-cut-line-renderer`) —
 * share one read path instead of re-inlining it.
 */
export function readRootCssVar(name: string, fallback = ''): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * ADR-446 §2 — resolve the LIVE 2D DXF canvas background colour as a concrete hex.
 *
 * `CANVAS_THEME.DXF_CANVAS` is the CSS variable `--canvas-background-dxf` (default
 * `#000000`, AutoCAD black). Consumers that cannot use a CSS variable directly — the
 * WebGL `scene.background` of the 3D «σαν 2Δ» dark mode — read THIS so the 3D dark
 * background is FULL SSoT with the 2D canvas: a theme switch (AutoCAD/Blender/…) moves
 * both views together. Falls back to the token default off-DOM (SSR / tests / workers).
 */
export function resolveDxfCanvasBackgroundHex(): string {
  return readRootCssVar('--canvas-background-dxf', UI_COLORS_BASE.CANVAS_BACKGROUND);
}

/** Explicit per-theme vertical canvas gradient stops (top→bottom). */
export interface CanvasGradientStops {
  /** Screen-TOP colour. */
  readonly top: string;
  /** Screen-BOTTOM colour. */
  readonly bottom: string;
}

/**
 * ADR-446 §2.1 — resolve the LIVE explicit canvas gradient stops as concrete hex.
 *
 * The theme switch sets `--canvas-gradient-top` / `--canvas-gradient-bottom` for themes that
 * carry an exact vertical gradient (e.g. Cinema 4D: `#5B5B5B`→`#868686`). Returns `null` for
 * solid themes (the variables are unset) — callers then fall back to their own behaviour: the
 * 2D canvas paints the flat `--canvas-background-dxf`, the 3D studio background derives a
 * symmetric base±delta gradient. Read here so 2D CSS and the 3D WebGL texture stay FULL SSoT
 * on the SAME two stops (a theme switch moves both views together).
 */
export function resolveDxfCanvasGradientStops(): CanvasGradientStops | null {
  const top = readRootCssVar('--canvas-gradient-top');
  const bottom = readRootCssVar('--canvas-gradient-bottom');
  return top && bottom ? { top, bottom } : null;
}

/**
 * Resolve a concrete hex from a `var(--name)` reference (or pass a hex through). Used by the
 * canvas-theme switch to read a per-theme PALETTE token (e.g. `--canvas-grid-cinema4d-major`)
 * into a concrete colour for consumers that cannot use CSS variables — notably Canvas2D
 * `ctx.strokeStyle` (the grid renderer). Reuses {@link readRootCssVar}; a non-`var()` input
 * (a plain hex) passes through unchanged.
 */
export function resolveCssVarColor(ref: string): string {
  const match = ref.match(/^var\((--[\w-]+)\)$/);
  return match ? readRootCssVar(match[1], ref) : ref;
}

// ============================================================================
// 🏢 ADR-142: ICON CLICK SEQUENCE COLORS (2026-02-01)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Icon Click Sequence Colors
 *
 * Unified colors for tool icon click indicators.
 * Used across all drawing tool icons (Line, Circle, Arc).
 *
 * Pattern: Red → Orange → Green (1st → 2nd → 3rd click)
 *
 * @see LineIcon.tsx, CircleIcon.tsx, ArcIcon.tsx
 * @see ADR-700 §4 — τα Angle*Icon components διαγράφηκαν (2026-07-25)· τα
 *      γωνιακά εικονίδια ζωγραφίζονται πλέον από MEASURE_ANGLE_*_PATH στο RibbonButtonIcon.
 * @see ADR-142: Icon Click Sequence Colors Centralization
 * @since 2026-02-01
 */
export const ICON_CLICK_COLORS = {
  /** 🩵 Teal/Turquoise - 1st click (start point) */
  FIRST: '#06b6d4',

  /** 🟡 Yellow - 2nd click (intermediate point) */
  SECOND: '#eab308',

  /** 🔴 Red - 3rd/last click (end point/cursor) */
  THIRD: '#ef4444',

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

// ============================================================================
// 🏢 PREVIEW CANVAS DEFAULTS (AutoCAD Standard)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Preview Canvas Default Render Options
 *
 * Centralized defaults for PreviewCanvas drawing previews.
 * AutoCAD standard: bright green preview lines with grip visualization.
 *
 * @see PreviewCanvas.tsx (defaultOptions prop)
 * @see CanvasSection.tsx (consumer)
 * @since 2026-02-15
 */
export const PREVIEW_DEFAULTS = {
  color: UI_COLORS.BRIGHT_GREEN,
  lineWidth: 1,
  opacity: OPACITY.HIGH,
  showGrips: true,
  gripSize: 6,
  gripColor: UI_COLORS.BRIGHT_GREEN,
} as const;

/**
 * 🏢 CENTRALIZED HOVER HIGHLIGHT CONFIG
 *
 * Single source of truth for ALL hover highlighting across the DXF viewer.
 * Previously scattered: PhaseManager (entity glow) vs guide-types (guide gold).
 *
 * @see PhaseManager.ts — applyHighlightedStyle()
 * @see guide-types.ts — HIGHLIGHT_GUIDE_STYLE
 * @see guide-renderer.ts — drawGuideLine() with glow
 */
export const HOVER_HIGHLIGHT = {
  /** Entity hover — double-stroke glow (GPU-free, replaces shadowBlur) */
  ENTITY: {
    glowColor: UI_COLORS.ENTITY_HOVER_GLOW,  // '#FFFF00' yellow
    glowExtraWidth: 6,  // extra pixels on top of entity lineWidth for glow layer
    glowOpacity: 0.35,  // semi-transparent so entity color shows through
    opacity: OPACITY.OPAQUE,
  },
  /** Guide hover — soft glow effect, keeps original guide color (AutoCAD-style) */
  GUIDE: {
    glowColor: '#FFD700',   // Gold glow halo — distinct from entity yellow
    shadowBlur: 12,         // Prominent glow — must be clearly visible
    lineWidth: 1.5,         // Slightly thicker than normal (0.5) but not harsh
    opacity: 0.9,           // Near-opaque during hover for clarity
    dashPattern: [] as readonly number[],
  },
  /**
   * Text hover — shadowBlur glow (acceptable: single entity, not 60fps all-entity path).
   * GPU cost is ~0.1ms/frame for 1 entity vs ~6ms/frame for all-entity shadowBlur.
   * Solves sub-pixel text appearing as outline-only on hover (Canvas2D anti-aliasing).
   */
  TEXT: {
    glowColor: UI_COLORS.ENTITY_HOVER_GLOW,  // '#FFFF00' — reuses entity SSOT color
    glowShadowBlur: 6,                         // soft halo radius (pixels)
  },
} as const;

/**
 * 🏢 ADR-739 Φ.Δ βήμα 2 — ΔΡΟΜΕΑΣ ΚΕΛΙΟΥ ΠΙΝΑΚΑ (το «τρέχον κελί»)
 *
 * Το ορθογώνιο που δείχνει ποιο κελί δέχεται την πληκτρολόγηση — το ισοδύναμο του
 * παχιού πλαισίου του Excel / Google Sheets.
 *
 * ── Γιατί ΟΧΙ το κίτρινο του hover ούτε το λευκό της επιλογής ──
 * Ο δρομέας συνυπάρχει **ταυτόχρονα** και με τα δύο: ο πίνακας είναι επιλεγμένος (λευκό)
 * και μπορεί να είναι και hovered (κίτρινη λάμψη) την ώρα που γράφεις. Τρίτη έννοια ⇒
 * τρίτο χρώμα, αλλιώς ο χρήστης δεν ξεχωρίζει «η οντότητα είναι επιλεγμένη» από «αυτό το
 * κελί δέχεται ό,τι πληκτρολογήσω». Το `INDICATOR_BLUE` είναι ήδη το χρώμα «δείκτη» του
 * viewer, άρα δεν γεννιέται τέταρτο λεξιλόγιο.
 *
 * ── Γιατί σταθερό πάχος σε px οθόνης ──
 * Ο δρομέας είναι στοιχείο **διεπαφής**, όχι γεωμετρία του σχεδίου: πρέπει να φαίνεται
 * ίδιος σε κάθε zoom, όπως οι λαβές. Πάχος σε sheet-mm θα εξαφανιζόταν σε zoom-out
 * ακριβώς όταν χρειάζεσαι να δεις πού βρίσκεσαι.
 */
export const TABLE_CELL_CURSOR = {
  /** Χρώμα περιγράμματος — δείκτης, όχι κατάσταση οντότητας. */
  colorHex: UI_COLORS.INDICATOR_BLUE,
  /** Πάχος σε px οθόνης, σταθερό σε κάθε κλίμακα. */
  lineWidthPx: 2,
} as const;

/**
 * 🔴 ADR-751 — ΤΟ ΜΕΛΑΝΙ ΤΩΝ ΔΙΕΥΘΥΝΣΕΩΝ ΜΕΣΑ ΣΤΑ ΚΕΛΙΑ (e-mail · ιστοσελίδα · τηλέφωνο)
 *
 * ── 🔴 Γιατί ΟΧΙ το `INDICATOR_BLUE`, παρότι είναι κι αυτό μπλε ──
 * Κάθε άλλο μπλε αυτού του αρχείου βάφει **διεπαφή**: δρομέα, επιλογή, φάντασμα μεταφοράς —
 * πράγματα που ζουν μόνο στην οθόνη και **δεν τυπώνονται ποτέ**. Ένας σύνδεσμος είναι
 * **περιεχόμενο**: μπαίνει στο PDF, γράφεται στο DXF, φτάνει στον πελάτη. Αν δανειζόταν το
 * χρώμα δείκτη, τότε (α) μια μελλοντική αλλαγή του `INDICATOR_BLUE` —καθαρά θέμα διεπαφής—
 * θα άλλαζε **τυπωμένα σχέδια**, και (β) στην οθόνη το κείμενο θα ήταν αδιάκριτο από το
 * περίγραμμα επιλογής που το περιβάλλει.
 *
 * ── Γιατί ΑΥΤΟ το μπλε ──
 * `#0563C1` είναι το χρώμα υπερσυνδέσμου του Office (Word/Excel) — ακριβώς η οικογένεια
 * εφαρμογών που ο πίνακας μιμείται ήδη σε περικοπή, επιλογή και συντομεύσεις. Είναι επίσης
 * αρκετά σκούρο ώστε να περνά την αντίθεση σε **λευκό χαρτί**, που το `#0099ff` δεν κάνει:
 * ένα χρώμα οθόνης κριμένο σε φόντο καμβά δεν είναι το ίδιο πρόβλημα με ένα χρώμα μελανιού.
 *
 * ── Γιατί το χρώμα ζει ΕΔΩ και όχι στο `TableTextLinkSpan` ──
 * Αν ταξίδευε μέσα στη διάταξη, κάθε αποθηκευμένη σκηνή θα κουβαλούσε **αντίγραφο** της
 * σημερινής απόφασης και μια αλλαγή θέματος θα άφηνε τα παλιά αρχεία στο παλιό μπλε — το
 * ίδιο σχήμα «η απόφαση παγώθηκε τη στιγμή Χ» που το ADR-748 κατέγραψε ως ελάττωμα.
 */
export const TABLE_CELL_LINK = {
  /** Το μελάνι των γραμμάτων του συνδέσμου. */
  colorHex: '#0563C1',
} as const;

/**
 * 🔴 ADR-739 Φ.Δ βήμα 4 / §37 — ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΛΕΙΤΟΥΡΓΙΑΣ («βρίσκεσαι μέσα σε αυτόν τον πίνακα»)
 *
 * Το **μελάνι** του δείκτη· η **θέση** του ζει στο `bim/table/table-indicator-geometry.ts`
 * (`tableModeOutlineRectMm`). Ο διαχωρισμός δεν είναι φορμαλισμός: από τη στιγμή που ο
 * δείκτης έπρεπε να **αποφύγει** γεωμετρία, η θέση του έγινε υπολογισμός με εισόδους — και
 * ένας υπολογισμός δεν ζει σε πίνακα χρωμάτων.
 *
 * ── Γιατί το μοτίβο έφυγε από τον ζωγράφο ──
 * Το `[6, 4]` ήταν **ιδιωτική σταθερά μέσα στο `stamp-table-layout.ts`**, δηλαδή το μόνο από
 * τα τέσσερα λεξιλόγια δείκτη του πίνακα (δρομέας · επιλογή · φάντασμα · λειτουργία) που δεν
 * φαινόταν εδώ. Όποιος διάβαζε αυτό το αρχείο για να απαντήσει «πώς δείχνει ο πίνακας τις
 * καταστάσεις του» έπαιρνε **τρεις** από τις τέσσερις απαντήσεις και δεν είχε τρόπο να το
 * καταλάβει.
 *
 * ── Γιατί ΙΔΙΟ χρώμα και ΙΔΙΟ πάχος με τον δρομέα, παράγωγα και όχι αντίγραφα ──
 * Ίδιο λεξιλόγιο («δείκτης διεπαφής»), άρα καμία νέα τιμή: μια αλλαγή του
 * {@link TABLE_CELL_CURSOR} οφείλει να ταξιδέψει και εδώ. Η **τάξη** τους διαφέρει και
 * λέγεται με τη **μορφή**: συμπαγές = εδώ πάει το πλήκτρο, διακεκομμένο = εδώ βρίσκεσαι.
 *
 * ── Γιατί ΔΕΝ λεπταίνει κάτω από 2 px ──
 * Το WCAG 2.2 SC 2.4.13 ορίζει ελάχιστη επιφάνεια δείκτη ίση με **περίμετρο 2 CSS px**. Η
 * λεπτότερη γραμμή ήταν η προφανής «λύση» στο ότι ο δείκτης έκρυβε το σχέδιο — και θα ήταν
 * παρηγοριά: 1 px εξακολουθεί να κάθεται πάνω σε γραμμή 0,13 mm. Το πρόβλημα ήταν η **θέση**,
 * όχι το πάχος.
 */
export const TABLE_MODE_OUTLINE = {
  /** Παράγωγο του δρομέα — ίδιο λεξιλόγιο, ποτέ δεύτερη κυριολεκτική τιμή. */
  colorHex: TABLE_CELL_CURSOR.colorHex,
  /** Παράγωγο του δρομέα· δες παραπάνω γιατί δεν λεπταίνει. */
  lineWidthPx: TABLE_CELL_CURSOR.lineWidthPx,
  /**
   * Το μοτίβο σε **px οθόνης** — ίδια μονάδα με το `lineWidthPx` και για τον ίδιο λόγο: ο
   * δείκτης πρέπει να φαίνεται ίδιος σε κάθε zoom. Σε sheet-mm θα γινόταν συμπαγής σε
   * σμίκρυνση και αραιός σε μεγέθυνση.
   */
  dashPx: [6, 4],
} as const;

/**
 * 🏢 ADR-739 Φ.Δ βήμα 8 — Η ΕΠΙΛΕΓΜΕΝΗ ΠΕΡΙΟΧΗ ΚΕΛΙΩΝ
 *
 * ── Γιατί ΓΕΜΙΣΜΑ και όχι δεύτερο περίγραμμα ──
 * Ο δρομέας κελιού είναι ήδη περίγραμμα, και το περίγραμμα λειτουργίας πίνακα (βήμα 4)
 * είναι διακεκομμένο περίγραμμα. Ένα **τρίτο** περίγραμμα θα ήταν αδιάκριτο από τα δύο
 * πρώτα σε κάθε γωνία που εφάπτονται. Το γέμισμα απαντά σε άλλη ερώτηση («ποια κελιά»)
 * και γι' αυτό χρησιμοποιεί άλλο μέσο — ακριβώς όπως στο Excel και στα Sheets.
 *
 * ── Γιατί ΗΜΙΔΙΑΦΑΝΟ ──
 * Ένα συμπαγές γέμισμα θα έκρυβε το κείμενο των κελιών, δηλαδή θα έκανε την επιλογή
 * αδύνατη να επαληθευτεί με το μάτι — το ίδιο σφάλμα που έκανε το `phaseColor` στο hover
 * (§19.8: «όποιο κελί έχει γέμισμα, χάνει το κείμενο»). Η διαφάνεια είναι **λειτουργική
 * απαίτηση**, όχι αισθητική.
 *
 * ── Γιατί ΤΟ ΙΔΙΟ χρώμα με τον δρομέα ──
 * Είναι το ίδιο λεξιλόγιο: «εδώ ενεργεί το πληκτρολόγιο». Ένα τέταρτο χρώμα θα έσπαγε τη
 * ρητή αιτιολόγηση του {@link TABLE_CELL_CURSOR}.
 */
export const TABLE_CELL_SELECTION = {
  /**
   * 🔴 ADR-739 §41 — **ΤΟ ΠΟΣΟΣΤΟ ΣΚΙΑΣΗΣ, ΜΕΤΡΗΜΕΝΟ ΑΠΟ ΤΟ ΙΔΙΟ ΤΟ EXCEL.**
   *
   * Δεν είναι επιλογή γούστου· είναι **ανάγνωση pixel** από στιγμιότυπο του Excel (04/08,
   * επιλογή `B10:C13`), και επαληθεύεται **δύο φορές μέσα στην ίδια εικόνα**:
   *
   * ```
   *   φόντο φύλλου   #FFFFFF (255) → επιλεγμένο #C6C6C6 (198)  ⇒ 1 − 198/255 = 0,2235
   *   γραμμή πλέγματος #E1E1E1 (225) → επιλεγμένη #AFAFAF (175)  ⇒ 225 × 0,7765 = 174,7 ✓
   * ```
   *
   * Η **δεύτερη** μέτρηση είναι η σημαντική: αν η σκίαση ήταν αδιαφανές γκρι, το πλέγμα μέσα
   * στην επιλογή θα είχε **εξαφανιστεί**. Το ότι σκουραίνει με το *ίδιο* ποσοστό αποδεικνύει
   * ότι το Excel βάφει ένα **αληθινό ημιδιαφανές στρώμα πάνω από τα πάντα**, όχι ένα γέμισμα
   * κάτω από το πλέγμα.
   *
   * ⚠️ Το ποσοστό ζει εδώ **ως αριθμός**, όχι ως έτοιμο `rgba(...)`: το *χρώμα* της σκίασης
   * εξαρτάται από την επιφάνεια και συντίθεται στο `tableSelectionWashRgba`
   * (`bim/table/table-ink.ts`) — δες εκεί γιατί δεν μπορεί να είναι σταθερά.
   */
  washAlpha: 0.2235,
  /**
   * Περίγραμμα ολόκληρης της περιοχής — συμπαγές, ίδιο χρώμα με τον δρομέα.
   *
   * ── Γιατί ΔΕΝ αντιγράφουμε το πράσινο `#217346` του Excel ──
   * Ίδιο επιχείρημα με την παλέτα αναφορών τύπου (δες {@link TABLE_FORMULA_REFERENCE}):
   * αντιγράφουμε τον **κανόνα** («η περιοχή έχει συμπαγές περίγραμμα στο χρώμα δείκτη της
   * εφαρμογής»), όχι τον **κατάλογο**. Το πράσινο είναι το accent του Excel· εδώ το accent
   * δείκτη είναι το `INDICATOR_BLUE`, ήδη σε χρήση από δρομέα και περίγραμμα λειτουργίας.
   */
  outlineHex: UI_COLORS.INDICATOR_BLUE,
  /**
   * Πάχος περιγράμματος περιοχής, σε px οθόνης — **2, μετρημένο** στο ίδιο στιγμιότυπο και
   * στις τρεις πλευρές που σαρώθηκαν (αριστερά `x=239..240`, πάνω `y=355..356`, δεξιά
   * `x=580..581`).
   *
   * Ήταν `1.5`, δηλαδή **μισό px**: ο καμβάς το μοίραζε σε δύο ημιδιαφανείς σειρές pixel και
   * το περίγραμμα διαβαζόταν ως θόλωμα αντί για γραμμή — ακριβώς πάνω στην ακμή όπου
   * ακουμπά τη σκίαση του ίδιου χρώματος. Παράγωγο του δρομέα, όχι δεύτερη τιμή: τα δύο
   * ορθογώνια συμπίπτουν όταν η επιλογή είναι 1×1, και **οφείλουν** να φαίνονται ένα.
   */
  outlineWidthPx: TABLE_CELL_CURSOR.lineWidthPx,
} as const;

/**
 * 🔴 ADR-754 Β1 — Η ΠΑΛΕΤΑ ΤΩΝ ΑΝΑΦΟΡΩΝ ΤΥΠΟΥ (τα χρωματιστά περιγράμματα του Excel)
 *
 * Όσο γράφεις `=SUM(A1:A5)+B2`, κάθε αναφορά αποκτά **δικό της χρώμα** και το αντίστοιχο
 * ορθογώνιο κελιών αποκτά περίγραμμα στο ίδιο χρώμα. Είναι το μοναδικό σημείο της διεπαφής
 * όπου το χρώμα **δεν** είναι διακόσμηση: είναι ο σύνδεσμος ανάμεσα σε δύο σημεία της οθόνης
 * που δεν μπορούν να μπουν το ένα δίπλα στο άλλο.
 *
 * ── 🔴 Γιατί Η ΠΑΛΕΤΑ ΔΕΝ ΞΕΚΙΝΑ ΜΕ ΜΠΛΕ, ενώ το Excel ξεκινά ──
 * Στο Excel η πρώτη αναφορά είναι **μπλε** και είναι σωστό εκεί, επειδή ο δρομέας του Excel
 * είναι **πράσινος**. Εδώ το `INDICATOR_BLUE` είναι ήδη κατειλημμένο τρεις φορές γύρω από τα
 * ίδια ακριβώς κελιά — δρομέας ({@link TABLE_CELL_CURSOR}), περίγραμμα λειτουργίας
 * ({@link TABLE_MODE_OUTLINE}), επιλογή ({@link TABLE_CELL_SELECTION}). Μια μπλε αναφορά θα
 * ήταν **τέταρτο** μπλε ορθογώνιο στην ίδια γειτονιά, και ο χρήστης θα έπρεπε να μαντέψει
 * ποιο σημαίνει «εδώ γράφω» και ποιο «αυτό διαβάζω». Αντιγράφουμε τον **κανόνα** του Excel
 * («κάθε αναφορά, δικό της χρώμα»), όχι τον **κατάλογό** του.
 *
 * ── Γιατί ΟΥΤΕ κόκκινο ──
 * Το κόκκινο (`ERROR`) σημαίνει ήδη **άρνηση** σε αυτό το αρχείο — το φάντασμα που δεν
 * επιτρέπεται να προσγειωθεί. Μια κόκκινη αναφορά θα διαβαζόταν ως «αυτό το κελί έχει
 * πρόβλημα», ενώ δεν έχει κανένα.
 *
 * ── Γιατί ΕΞΙ και όχι οκτώ ──
 * Πάνω από έξι διακριτές περιοχές σε **έναν** τύπο, ο κύκλος επαναλαμβάνεται. Είναι αποδεκτό
 * επειδή το χρώμα εδώ είναι **δευτερεύον** κανάλι: το κύριο είναι η **θέση** (κάθε περίγραμμα
 * κάθεται σε άλλα κελιά). Ένας τύπος με επτά διαφορετικές περιοχές είναι ήδη έξω από το
 * σημείο όπου το χρώμα βοηθά, και επιπλέον απόχρωση θα ήταν επιπλέον απόχρωση **δίπλα** σε
 * υπάρχουσα — δηλαδή θα χειροτέρευε τη διάκριση, όχι θα την καλύτερευε.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ.** Ο δείκτης παλέτας παράγεται από τη **σειρά πρώτης
 * εμφάνισης** της αναφοράς μέσα στον τύπο (`table-formula-reference-spans`). Αναδιάταξη εδώ
 * αλλάζει ποιο κελί είναι τι — μην την πειράξεις για αισθητικό λόγο.
 */
export const TABLE_FORMULA_REFERENCE = {
  /**
   * Έξι αποχρώσεις, ευδιάκριτες πάνω στο **μαύρο** φόντο καμβά (`CANVAS_BACKGROUND`) και
   * καμία τους δεν είναι το μπλε του δείκτη ή το κόκκινο της άρνησης — δες παραπάνω.
   *
   * ⚠️ Ο κύκλος πράσινο → πορτοκαλί → μωβ ξεκινά με τα **τρία** που παραμένουν διακριτά και
   * υπό δυσχρωματοψία (μεταβολή φωτεινότητας, όχι μόνο απόχρωσης). Τα υπόλοιπα τρία
   * εμφανίζονται μόνο σε τύπους με 4+ περιοχές, όπου η θέση έχει ήδη αναλάβει τη δουλειά.
   */
  paletteHex: ['#22C55E', '#F97316', '#A855F7', '#EC4899', '#EAB308', '#14B8A6'],
  /**
   * Ίδιο πάχος με τον δρομέα — δεν είναι λιγότερο σημαντικό από αυτόν, και το WCAG 2.2
   * SC 2.4.13 απαιτεί ούτως ή άλλως περίμετρο 2 CSS px (δες {@link TABLE_MODE_OUTLINE}).
   */
  lineWidthPx: TABLE_CELL_CURSOR.lineWidthPx,
  /**
   * **Διακεκομμένο**, με πυκνότερο βήμα από το περίγραμμα λειτουργίας (`[6, 4]`): η μορφή
   * κουβαλά ήδη νόημα σε αυτό το αρχείο — συμπαγές = «εδώ πάει το πλήκτρο», διακεκομμένο =
   * «αναφορά κάπου αλλού». Το πυκνότερο βήμα ξεχωρίζει τη μία διακεκομμένη από την άλλη όταν
   * τύχει να εφάπτονται.
   *
   * Σε **px οθόνης**, όπως κάθε άλλος δείκτης εδώ: ίδια εμφάνιση σε κάθε zoom.
   */
  dashPx: [4, 3],
} as const;

/**
 * 🔴 ADR-739 §36 ΦΑΣΗ 3 — ΤΟ ΦΑΝΤΑΣΜΑ ΠΡΟΟΡΙΣΜΟΥ ΤΗΣ ΜΕΤΑΦΟΡΑΣ ΠΕΡΙΟΧΗΣ
 *
 * ── Γιατί ΤΟ ΙΔΙΟ μπλε με την επιλογή, και η διαφορά λέγεται με τη ΜΟΡΦΗ ──
 * Το φάντασμα και η επιλογή είναι **το ίδιο πράγμα σε δύο χρόνους**: «αυτά τα κελιά, εκεί που
 * είναι» και «αυτά τα κελιά, εκεί που θα πάνε». Ένα τέταρτο χρώμα θα έλεγε ότι πρόκειται για
 * άλλη έννοια — και θα έσπαγε τη ρητή αιτιολόγηση του {@link TABLE_CELL_CURSOR}, όπου το
 * `INDICATOR_BLUE` **είναι** το χρώμα «δείκτη διεπαφής» του πίνακα.
 *
 * Η διάκριση γίνεται όπως ήδη γίνεται μία φορά σε αυτό το αρχείο (περίγραμμα λειτουργίας):
 * **συμπαγές = τώρα, διακεκομμένο = αλλού**. Είναι επίσης ακριβώς ό,τι δείχνουν Excel και
 * Sheets στη σύρση — διάστικτο περίγραμμα που ακολουθεί το χέρι.
 *
 * ── Γιατί ΑΧΝΟΤΕΡΟ γέμισμα από την επιλογή ──
 * Το φάντασμα ζωγραφίζεται **πάνω** από το κείμενο (δες `stamp-table-range-ghost`), σε αντίθεση
 * με την επιλογή που μπαίνει από κάτω. Στο 0.18 της επιλογής θα θόλωνε το κείμενο του
 * προορισμού — δηλαδή θα έκρυβε ακριβώς τα δεδομένα για τα οποία ο χρήστης θα ρωτηθεί στη
 * Φάση 4 («θα σβηστούν;»).
 */
export const TABLE_RANGE_GHOST = {
  /** Γέμισμα προορισμού — παράγωγο του ίδιου μπλε, πιο αχνό από την επιλογή (δες παραπάνω). */
  fillRgba: hexToRgba(UI_COLORS.INDICATOR_BLUE, 0.1),
  /** Περίγραμμα προορισμού — **διακεκομμένο**, ίδιο μπλε. */
  outlineHex: UI_COLORS.INDICATOR_BLUE,
  outlineWidthPx: 2,
  /** Το μοτίβο σε **px οθόνης**: δείκτης διεπαφής, άρα ίδιος σε κάθε zoom. */
  outlineDashPx: [5, 3],
  /**
   * ── Η ΑΡΝΗΣΗ, ΟΡΑΤΗ ──
   * Όταν το σχέδιο απαντά «όχι» (συγχώνευση στον στόχο, εκτός πλέγματος), το φάντασμα **δεν
   * σιωπά**: αλλάζει σε κόκκινο και ο δείκτης του ΟΣ γίνεται `not-allowed`. Δύο ανεξάρτητα
   * κανάλια για την ίδια πληροφορία, γιατί το ένα από τα δύο μπορεί να λείπει — δεν υπάρχει
   * ορθογώνιο να βαφτεί όταν το χέρι είναι **έξω** από το πλέγμα.
   */
  refusedFillRgba: hexToRgba(UI_COLORS.ERROR, 0.1),
  refusedOutlineHex: UI_COLORS.ERROR,
  /**
   * ── Η ΓΡΑΜΜΗ-Ι ΤΟΥ `Shift` ──
   * Το Excel τη δείχνει ως **παχιά γκρι** μπάρα, και το γκρι είναι σκόπιμο: δηλώνει «αλλαγή
   * **δομής**», όχι «επιλογή». Δανείζεται το μελάνι του δείκτη πίνακα (`RULER_TEXT_GRAY`) —
   * καμία νέα τιμή, ίδια οικογένεια με τον χάρακα που στεφανώνει τον πίνακα.
   */
  insertCaretHex: UI_COLORS.RULER_TEXT_GRAY,
  /** Παχιά — η γραμμή-Ι πρέπει να ξεχωρίζει από τη γραμμή του πλέγματος που εφάπτεται. */
  insertCaretWidthPx: 4,
} as const;

/**
 * 🏢 ADR-739 Φ.Δ βήμα 7 — ΔΕΙΚΤΗΣ ΠΙΝΑΚΑ (γράμματα στηλών + αριθμοί γραμμών)
 *
 * Οι δύο ζώνες που εμφανίζονται γύρω από τον πίνακα **μόνο όσο τον επεξεργάζεσαι**: `A B C`
 * στην πάνω πλευρά, `1 2 3` στην αριστερή. Είναι κυριολεκτικά η `TABLEINDICATOR` του
 * AutoCAD, με την τυπογραφία του Excel.
 *
 * ── Γιατί δανείζεται την παλέτα του ΧΑΡΑΚΑ και δεν γεννά δική του ──
 * Ο δείκτης πίνακα **είναι** χάρακας: μια βαθμονομημένη ζώνη στην άκρη μιας περιοχής, που
 * λέει «πού βρίσκεσαι» και δεν είναι μέρος του σχεδίου. Ο viewer έχει ήδη λεξιλόγιο γι'
 * αυτό (`RULER_*`) και το χρησιμοποιεί στους δύο χάρακες του καμβά. Νέο σύνολο χρωμάτων για
 * την ίδια έννοια θα σήμαινε ότι ο ίδιος ρόλος δείχνει αλλιώς σε δύο σημεία της ίδιας
 * οθόνης — και θα απέκλινε στην πρώτη αλλαγή θέματος.
 *
 * ── Γιατί το ενεργό κελί ζώνης παίρνει το χρώμα του ΔΡΟΜΕΑ ──
 * Η φωτισμένη στήλη/γραμμή απαντά στην **ίδια** ερώτηση με τον δρομέα κελιού («εδώ πάει το
 * πλήκτρο»), απλώς προβεβλημένη στους δύο άξονες. Ίδια ερώτηση ⇒ ίδιο χρώμα, αλλιώς ο
 * χρήστης θα έψαχνε νόημα σε μια διαφορά που δεν υπάρχει.
 *
 * ── Γιατί ΟΛΑ τα μεγέθη σε px οθόνης ──
 * Ίδιο επιχείρημα με το {@link TABLE_CELL_CURSOR}: στοιχείο διεπαφής, όχι γεωμετρία. Σε
 * sheet-mm η ζώνη θα γινόταν γιγάντια σε zoom-in και θα εξαφανιζόταν σε zoom-out.
 */

/**
 * 🔴 ADR-739 §27.13 — **ΕΝΑ** πάχος και για τις δύο ζώνες (Giorgio, 2026-08-02).
 *
 * Μέχρι τότε ήταν `18` (πάνω) και `28` (αριστερά): η αριστερή είχε **πλάτος** ώστε να χωρά
 * τετραψήφιο αριθμό γραμμής, η πάνω είχε **ύψος** μιας σειράς κειμένου. Δύο σωστές
 * απαντήσεις σε δύο διαφορετικές ερωτήσεις — που όμως έδιναν **ορθογώνια** γωνία ένωσης και
 * ένα πλαίσιο με ανομοιόμορφο πάχος, δηλαδή δύο χάρακες αντί για έναν.
 *
 * Ο Giorgio ζήτησε ρητά το ύψος της πάνω να γίνει **ίσο** με το πλάτος της αριστερής. Οδηγός
 * παραμένει η αριστερή (η απαίτηση «χωρά τετραψήφια» είναι **μετρήσιμη**· το «μια σειρά
 * κειμένου» χωρά άνετα και στα 28) — γι' αυτό υπάρχει **μία** σταθερά και δύο ονόματα που
 * τη διαβάζουν: έτσι δεν μπορούν ποτέ να ξαναποκλίνουν σιωπηλά.
 */
const TABLE_INDICATOR_BAND_PX = 28;

export const TABLE_INDICATOR = {
  /** Γέμισμα ζώνης — η ουδέτερη επιφάνεια του χάρακα. */
  fillHex: UI_COLORS.RULER_NEUTRAL_GRAY,
  /** Μελάνι γραμμάτων/αριθμών. */
  textHex: UI_COLORS.RULER_TEXT_GRAY,
  /** Διαχωριστικές γραμμές ανάμεσα σε γειτονικές στήλες/γραμμές της ζώνης. */
  lineHex: UI_COLORS.RULER_DARK_GRAY,
  /** Γέμισμα της **ενεργής** στήλης/γραμμής — δες το σκεπτικό παραπάνω. */
  activeFillHex: UI_COLORS.INDICATOR_BLUE,
  /** Μελάνι πάνω στο ενεργό γέμισμα (αντίθεση σε συμπαγές μπλε). */
  activeTextHex: UI_COLORS.WHITE,
  /**
   * 🔴 ADR-739 §30 — **η υποδιαίρεση ΚΑΤΩ ΑΠΟ ΤΟ ΠΟΝΤΙΚΙ**: ημιδιαφανές **σιέλ** «πλύσιμο»
   * που μπαίνει **πάνω** από το γέμισμα, όποιο κι αν είναι αυτό.
   *
   * ── Ο κανόνας, όπως τον έθεσε ο Giorgio (2026-08-03) ──
   * «Θέλω το χρώμα του hover να είναι **σιέλ**. Δηλαδή να μοιάζει με το χρώμα επιλογής
   * στήλης, αλλά να είναι **πιο αχνό**.» Η διατύπωση **είναι** η υλοποίηση: το σιέλ δεν
   * γράφεται εδώ ως νέο hex — **παράγεται** από το ίδιο το χρώμα επιλογής, ξεπλυμένο προς το
   * λευκό. Ένα καινούριο `#a5d7f9` θα ήταν τέταρτο χρώμα που «τυχαίνει» να ταιριάζει, και θα
   * ξέμενε την πρώτη φορά που αλλάξει το `INDICATOR_BLUE`. Έτσι, «πιο αχνό από την επιλογή»
   * παραμένει αληθές **εξ ορισμού**.
   *
   * ── Γιατί πλύσιμο και όχι τρίτο χρώμα γεμίσματος ──
   * Ένα `hoverFillHex` θα άφηνε αναπάντητη τη μία περίπτωση που σίγουρα συμβαίνει: hover πάνω
   * σε **ήδη ενεργή** στήλη. Εκεί το «τρίτο χρώμα» ή θα έσβηνε τη δήλωση της ενεργής, ή θα
   * ήταν ταυτόσημο με αυτήν και ο χρήστης δεν θα έπαιρνε **καμία** απόκριση. Το πλύσιμο
   * απαντά και στις δύο με **έναν** κανόνα — «η λωρίδα τραβιέται προς το σιέλ»:
   *
   * | από κάτω | αποτέλεσμα | ορατό; |
   * |---|---|---|
   * | ουδέτερο γκρι `#f0f0f0` | `#abd9f8` — σιέλ | ✅ |
   * | ενεργό μπλε `#0099ff` | `#3fb2ff` — ξεπλυμένο μπλε | ✅ |
   *
   * ⚠️ **Μετρημένο τίμημα, όχι σιωπηλό**: πάνω στην **ενεργή** στήλη η αντίθεση της λευκής
   * ετικέτας πέφτει από `3,0:1` σε `≈2,3:1`. Δεν είναι νέα παραβίαση κατηγορίας (η ενεργή
   * ήταν ήδη κάτω από το 4,5:1 με τα ίδια δύο χρώματα) και η κατάσταση είναι **εφήμερη** —
   * ζει όσο το χέρι στέκεται εκεί. Αν κάποτε ανέβει το κατώφλι, το ένα σημείο που αλλάζει
   * είναι το `t` της ανάμειξης, όχι εννέα κλήσεις ζωγραφικής.
   */
  hoverWashRgba: hexToRgba(mixHex(UI_COLORS.INDICATOR_BLUE, UI_COLORS.WHITE, 0.45), 0.55),
  /** Ύψος της πάνω ζώνης (γράμματα), σε px οθόνης — δες {@link TABLE_INDICATOR_BAND_PX}. */
  columnBandPx: TABLE_INDICATOR_BAND_PX,
  /** Πλάτος της αριστερής ζώνης (αριθμοί), σε px οθόνης — **η ίδια** σταθερά: χωρά τετραψήφια. */
  rowBandPx: TABLE_INDICATOR_BAND_PX,
  /** Ύψος κεφαλαίου γράμματος μέσα στη ζώνη, σε px οθόνης. */
  fontPx: 11,
  /** Πάχος διαχωριστικών/περιγράμματος ζώνης, σε px οθόνης. */
  lineWidthPx: 1,
} as const;

/**
 * 🔴 ADR-739 §40 — **ΤΟ ⊕ ΤΗΣ ΕΙΣΑΓΩΓΗΣ** (full parity με το Word): τα δύο χρώματα των δύο
 * φάσεων, και η γραμμή που δείχνει πού θα μπει η νέα γραμμή/στήλη.
 *
 * ## Οι δύο φάσεις ΔΕΝ είναι δύο άσχετες παλέτες
 * Το ουδέτερο ⊕ (`nearby`) λέει «*εδώ υπάρχει κάτι*»· το ενεργό (`armed`) λέει «*και τώρα θα
 * το κάνει*». Το δεύτερο δανείζεται **αυτούσιο** το `INDICATOR_BLUE` της ενεργής ζώνης — δεν
 * γράφεται νέο hex. Έτσι «η ενεργή κατάσταση του πίνακα είναι μπλε» παραμένει αληθές εξ
 * ορισμού, και μια μελλοντική αλλαγή του μπλε παρασύρει και το ⊕ χωρίς να το θυμηθεί κανείς.
 *
 * ⚠️ Το ουδέτερο γέμισμα είναι **λευκό, όχι διάφανο**. Ο δίσκος κάθεται πάνω από το σχέδιο —
 * κάτω του μπορεί να περνά οποιαδήποτε γραμμή κάτοψης. Διάφανο γέμισμα θα άφηνε τον σταυρό να
 * διαβάζεται πάνω σε τοίχο ή διαστασιολόγηση, δηλαδή το χειριστήριο θα εξαφανιζόταν ακριβώς
 * στα πυκνά σχέδια όπου ο χρήστης το χρειάζεται περισσότερο.
 *
 * @see bim/table/table-insert-control.ts — ΠΟΥ κάθεται (η γεωμετρία που τα καταναλώνει)
 */
export const TABLE_INSERT_CONTROL = {
  /** Γέμισμα δίσκου στη φάση `nearby` — δες την κεφαλίδα: συμπαγές, ποτέ διάφανο. */
  fillHex: UI_COLORS.WHITE,
  /** Περίγραμμα δίσκου στη φάση `nearby` — το ίδιο μελάνι με τις γραμμές της ζώνης. */
  lineHex: UI_COLORS.RULER_DARK_GRAY,
  /** Ο σταυρός στη φάση `nearby`. */
  glyphHex: UI_COLORS.RULER_TEXT_GRAY,
  /** Γέμισμα δίσκου στη φάση `armed` — **το ίδιο** μπλε με την ενεργή ζώνη. */
  armedFillHex: UI_COLORS.INDICATOR_BLUE,
  /** Ο σταυρός πάνω στο συμπαγές μπλε. */
  armedGlyphHex: UI_COLORS.WHITE,
  /** Η γραμμή που δείχνει **πού** θα μπει η νέα γραμμή/στήλη — μόνο στη φάση `armed`. */
  caretHex: UI_COLORS.INDICATOR_BLUE,
  /** Πάχος περιγράμματος δίσκου, σε px οθόνης. */
  lineWidthPx: 1,
  /** Πάχος του σταυρού, σε px οθόνης. */
  glyphWidthPx: 1.5,
  /** Πάχος της γραμμής προεπισκόπησης, σε px οθόνης. */
  caretWidthPx: 2,
} as const;

// ============================================================================
// 🏢 ADR-366 §A.3 — SECTION CUT SURFACE COLOR (2026-05-20)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Section Cut Cap Surface (Phase 7.0)
 *
 * Solid semi-transparent grey fill για το cut face του 3D section box / plane.
 * Justified ως NEW token: το 2D DXF Viewer δεν έχει αντίστοιχη έννοια
 * (clip-volume cap surface). Hatched variants → Phase 7.1+ (ADR-363 ShaderType).
 *
 * @see ADR-366 §A.3.Q4 — Cut surface visual decision
 */
export const SECTION_CUT_SURFACE = {
  /** Hex color για solid cap fill — neutral grey, photoreal-friendly */
  color: '#9e9e9e',
  /** Opacity για cap mesh — semi-transparent ώστε εσωτερικό να φαίνεται */
  opacity: 0.5,
  /** Emphasis color για selected entity cap — mirrors HOVER_HIGHLIGHT.ENTITY.glowColor SSoT (Phase 7.0C) */
  selectedCapColor: HOVER_HIGHLIGHT.ENTITY.glowColor,
  /** Opacity για selected emphasis cap — solid enough to signal selection clearly */
  selectedCapOpacity: 0.85,
} as const;

export type SectionCutSurfaceKey = keyof typeof SECTION_CUT_SURFACE;

// ============================================================================
// 🏢 ADR-366 §A.3 Q3 — 2D LIVE SECTION PANEL COLORS (Phase 7.0B, 2026-05-20)
// ============================================================================

/**
 * 🏢 ENTERPRISE: 2D Section Panel — per-element flat colors + outline + selected
 *
 * Color spectrum για flat 2D architectural section view (filled rectangles +
 * outlines, OrthographicCamera, standalone WebGLRenderer).
 *
 * Justified ως NEW token: Nestor 2D DXF Viewer δεν έχει αντίστοιχο 2D section
 * panel widget — first occurrence στο codebase. Mirror γκρι spectrum από
 * GenArc loupe palette (proven industry σύμβαση Revit/AutoCAD section views)
 * + selected highlight reuses HOVER_HIGHLIGHT.ENTITY.glowColor SSoT για
 * συνέπεια με 2D selection palette.
 *
 * @see ADR-366 §A.3.Q3 — 2D Live Section Panel decision
 * @see SPEC-3D-004A §3.2 — GenArc loupe LOUPE_COLOR_* port reference
 */
export const SECTION_2D_PANEL_COLORS = {
  /** Background του panel canvas — dark neutral, matches 3D viewport */
  background: '#1a1a1a',
  /** Wall fill — dark grey (structural concrete σύμβαση) */
  wall: '#6c6c6c',
  /** Column fill — slightly darker grey (load-bearing emphasis) */
  column: '#5a5a5a',
  /** Beam fill — medium grey (structural σύμβαση) */
  beam: '#7a7a7a',
  /** Slab fill — light grey (horizontal element σύμβαση) */
  slab: '#9e9e9e',
  /** Selected element highlight — reuses 2D entity hover yellow (SSoT mirror) */
  selected: '#FFFF00',
  /** Outline stroke — dark contrast, edge clarity */
  outline: '#2a2a2a',
} as const;

export type Section2DPanelColorKey = keyof typeof SECTION_2D_PANEL_COLORS;
