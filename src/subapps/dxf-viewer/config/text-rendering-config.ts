/**
 * TEXT RENDERING CONFIGURATION - UNIFIED CONSTANTS
 * =================================================
 *
 * ENTERPRISE: Centralized text rendering constants for Canvas 2D
 * Single source of truth for DXF text entity rendering
 *
 * This config handles:
 * - Minimum readable text sizes (zoom-out scenarios)
 * - Default text heights (CAD standard)
 * - Character width ratios (hit testing)
 * - Font configuration
 *
 * @see TextRenderer.ts - Consumer of these constants
 * @see ISO 3098 - CAD text standards
 * @see AutoCAD DXF Reference - Text entity specifications
 * @created 2026-01-02
 */

// ============================================
// TEXT SIZE LIMITS
// ============================================

/**
 * Text size limits for canvas rendering
 *
 * RATIONALE:
 * - MIN_READABLE_SIZE: 8px ensures text remains legible when zoomed out
 *   (Previously 4px was too small for Greek characters and annotations)
 * - MAX_SCREEN_SIZE: 500px prevents excessively large text when zoomed in
 * - DEFAULT_HEIGHT: 2.5 drawing units is AutoCAD standard for annotations
 *
 * INDUSTRY STANDARDS:
 * - AutoCAD: Default text height 2.5mm for A4 drawings
 * - ISO 3098: Minimum character height 2.5mm for readability
 * - BricsCAD: Similar defaults to AutoCAD
 */
export const TEXT_SIZE_LIMITS = {
  /**
   * Minimum readable size in screen pixels
   * ENTERPRISE FIX: Increased from 4 to 8 for better readability
   * Especially important for Greek characters and small annotations
   */
  MIN_READABLE_SIZE: 8,

  /**
   * Maximum screen size in pixels
   * Prevents text from becoming excessively large when zoomed in
   */
  MAX_SCREEN_SIZE: 500,

  /**
   * Default text height in drawing units (CAD standard)
   * Used when entity has no fontSize specified
   * Based on ISO 3098 and AutoCAD defaults
   */
  DEFAULT_HEIGHT: 2.5,

  /**
   * Minimum valid text height in drawing units
   * Entities with height below this are considered invalid
   */
  MIN_VALID_HEIGHT: 0.1,

  /**
   * 🏢 ADR-142: Default font size for text entities (drawing units)
   * Used when entity has no fontSize/height specified
   * Safe fallback that provides readable text in most contexts
   *
   * Note: Different from DEFAULT_HEIGHT (2.5) which is ISO 3098 standard
   * This is a practical fallback for entities with missing fontSize
   *
   * @see entities.ts - getEntityBounds()
   * @see Bounds.ts - calculateTextBounds()
   * @see text-spline-renderers.ts - renderTextHover()
   * @see bounds.ts - createBoundsFromDxfScene()
   * @see useTextPreviewStyle.ts - getTextPreviewStyle()
   * @see dxf-scene-builder.ts - normalizeTextHeights()
   * @since 2026-02-01
   */
  DEFAULT_FONT_SIZE: 12,
} as const;

// ============================================
// CHARACTER METRICS
// ============================================

/**
 * Character metrics for text measurement and hit testing
 *
 * RATIONALE:
 * - WIDTH_RATIO: 0.6 is standard for proportional fonts like Arial
 *   (Average character width is ~60% of height)
 * - MONOSPACE_WIDTH_RATIO: 0.6 for fixed-width fonts
 * - LINE_HEIGHT_RATIO: 1.2 for multi-line text spacing
 *
 * These are approximations for hit testing and bounding box calculation.
 * Actual rendering uses canvas measureText() for precision.
 */
export const CHARACTER_METRICS = {
  /**
   * Character width as ratio of height (proportional fonts)
   * Arial, Helvetica: ~0.55-0.65 average
   * Using 0.6 as safe middle ground
   */
  WIDTH_RATIO: 0.6,

  /**
   * Character width for monospace fonts
   * Courier, Consolas: consistent 0.6 ratio
   */
  MONOSPACE_WIDTH_RATIO: 0.6,

  /**
   * Line height multiplier for multi-line text
   * Standard typographic line height: 1.2 (120%)
   */
  LINE_HEIGHT_RATIO: 1.2,

  /**
   * Superscript/subscript scale factor
   * Standard: 0.7 (70% of normal size)
   */
  SCRIPT_SCALE: 0.7,
} as const;

// ============================================
// FONT CONFIGURATION
// ============================================

/**
 * Font configuration for text rendering
 *
 * RATIONALE:
 * - DEFAULT_FAMILY: Arial is universally available and CAD-standard
 * - FALLBACK_STACK: Progressive fallback for cross-platform compatibility
 * - BASELINE: 'bottom' matches DXF text positioning (insertion point at baseline)
 */
export const TEXT_FONTS = {
  /**
   * Default font family for text entities
   * Arial is standard for CAD applications
   */
  DEFAULT_FAMILY: 'Arial',

  /**
   * CSS font-family fallback stack
   * Ensures text renders on all platforms
   */
  FALLBACK_STACK: 'Arial, Helvetica, sans-serif',

  /**
   * Default text baseline for canvas rendering
   * 'bottom' matches DXF insertion point semantics
   */
  DEFAULT_BASELINE: 'bottom' as CanvasTextBaseline,

  /**
   * Default text alignment
   * 'left' is standard for most CAD text
   */
  DEFAULT_ALIGN: 'left' as CanvasTextAlign,
} as const;

// ============================================
// 🏢 ADR-042: UI OVERLAY FONTS (2026-01-27)
// ============================================

/**
 * 🏢 ENTERPRISE: UI Overlay Font Configuration
 *
 * Centralized font strings for canvas UI elements (NOT DXF text entities).
 * Used for: coordinate labels, layer names, snap indicators, debug overlays.
 *
 * Pattern: Autodesk AutoCAD / Bentley MicroStation - Consistent UI typography
 *
 * @see ADR-042: Centralized UI Fonts
 * @since 2026-01-27
 */
export const UI_FONTS = {
  /**
   * Monospace fonts - For coordinate displays, debug info, code-like text
   * Consistent character width for aligned columns
   */
  MONOSPACE: {
    /** 10px - Small labels, secondary info */
    SMALL: '10px monospace',
    /** 12px - Standard UI text, coordinates */
    NORMAL: '12px monospace',
    /** 14px - Emphasized text, headers */
    LARGE: '14px monospace',
    /** Bold 12px - Layer names, important labels */
    BOLD: 'bold 12px monospace',
    /** Bold 14px - Section headers, titles */
    BOLD_LARGE: 'bold 14px monospace',
  },

  /**
   * Arial fonts - For general UI text, measurements, snap labels
   * Better readability for mixed text
   */
  ARIAL: {
    /** 11px - Compact labels */
    SMALL: '11px Arial',
    /** 12px - Standard labels */
    NORMAL: '12px Arial',
    /** 14px - Larger labels */
    LARGE: '14px Arial',
    /** Bold 12px - Emphasized labels */
    BOLD: 'bold 12px Arial',
  },

  /**
   * System UI fonts - For native-looking UI elements
   * Best rendering on each platform
   */
  SYSTEM: {
    /** 12px - Standard system font */
    NORMAL: '12px system-ui, -apple-system, sans-serif',
  },

  /**
   * 🏢 ADR-090: Inter fonts - For collaboration overlays, UI labels
   * Modern, readable font for interactive elements
   * @since 2026-01-31
   */
  INTER: {
    /** 10px - Small labels, annotations */
    SMALL: '10px Inter, sans-serif',
    /** 12px - Standard UI text, cursor labels */
    NORMAL: '12px Inter, sans-serif',
    /** Bold 10px - Emphasized small text, annotation markers */
    BOLD_SMALL: 'bold 10px Inter, sans-serif',
  },
} as const;

/**
 * 🏢 ENTERPRISE: Build custom UI font string
 *
 * For cases where predefined constants don't fit.
 * Use sparingly - prefer predefined constants.
 *
 * @param size - Font size in pixels
 * @param family - Font family ('monospace' | 'Arial' | 'system-ui')
 * @param weight - Optional font weight ('normal' | 'bold')
 * @returns CSS font string for canvas.font property
 */
/** Supported font families for buildUIFont */
export type UIFontFamily = 'monospace' | 'Arial' | 'arial' | 'system-ui' | 'Inter, sans-serif';

export function buildUIFont(
  size: number,
  family: UIFontFamily | string = 'monospace',
  weight: 'normal' | 'bold' = 'normal'
): string {
  const weightPrefix = weight === 'bold' ? 'bold ' : '';
  return `${weightPrefix}${size}px ${family}`;
}

// ============================================
// 🏢 ADR-044: CANVAS LINE WIDTHS (2026-01-27)
// ============================================

/**
 * 🏢 ENTERPRISE: Canvas Line Width Configuration
 *
 * Centralized line width constants for Canvas 2D rendering.
 * Eliminates 32+ hardcoded `ctx.lineWidth = X` values across 15 files.
 *
 * Pattern: Autodesk AutoCAD / Bentley MicroStation - Unified symbology
 *
 * RATIONALE:
 * - THIN (1px): Minimum visible line - rulers, grid, minor elements
 * - NORMAL (2px): Standard stroke - entities, shapes, selection
 * - THICK (3px): Emphasis - borders, highlights, layer names
 *
 * @see ADR-044: Centralized Canvas Line Widths
 * @see Autodesk AutoCAD LWDEFAULT system variable
 * @see Bentley MicroStation MS_SYMBOLOGY
 * @since 2026-01-27
 */
export const RENDER_LINE_WIDTHS = {
  // ────────────────────────────────────────────
  // CORE RENDERING (Canvas 2D ctx.lineWidth)
  // ────────────────────────────────────────────

  /** 1px - Minimum visible: grid lines, ruler ticks, construction lines */
  THIN: 1,

  /** 2px - Standard stroke: entities, shapes, selection rectangles */
  NORMAL: 2,

  /** 3px - Emphasis: borders, highlights, layer name backgrounds */
  THICK: 3,

  // ────────────────────────────────────────────
  // SPECIAL PURPOSE
  // ────────────────────────────────────────────

  /** Drawing preview lines (during tool operation) */
  PREVIEW: 1,

  /** 🏢 ENTERPRISE (2026-01-31): Construction lines for arc preview (dashed rubber band) */
  PREVIEW_CONSTRUCTION: 1,

  /** Ruler tick marks */
  RULER_TICK: 1,

  /** Selection marquee/rectangle stroke */
  SELECTION: 2,

  /** Grip point outlines (cold/normal state) */
  GRIP_OUTLINE: 1,

  /** 🏢 ADR-154: Grip point outlines (warm/hot/active state) */
  GRIP_OUTLINE_ACTIVE: 2,

  /** Debug/development overlays */
  DEBUG: 2,

  // ────────────────────────────────────────────
  // OVERLAY RENDERING (Thick for visibility)
  // ────────────────────────────────────────────

  /** Polygon overlay stroke (property boundaries, zones) */
  OVERLAY: 12,

  /** Selected overlay stroke (highlighted polygons) */
  OVERLAY_SELECTED: 15,

  // ────────────────────────────────────────────
  // GHOST ENTITY RENDERING
  // ────────────────────────────────────────────

  /** Ghost entity stroke (move/copy preview) */
  GHOST: 1,

  /** Delta comparison lines */
  DELTA: 1,
} as const;

/**
 * 🏢 ENTERPRISE: Line width type
 */
export type RenderLineWidth = typeof RENDER_LINE_WIDTHS[keyof typeof RENDER_LINE_WIDTHS];

// ============================================
// 🏢 ADR-048: RENDERING GEOMETRY CONSTANTS (2027-01-27)
// ============================================

/**
 * 🏢 ENTERPRISE: Rendering Geometry Configuration
 *
 * Centralized geometric constants for entity rendering.
 * Eliminates hardcoded magic numbers in rendering logic.
 *
 * Pattern: Autodesk AutoCAD / Bentley MicroStation - Unified rendering constants
 *
 * RATIONALE:
 * - SPLIT_LINE_GAP: 30px standard gap for distance text in preview mode
 *   (Distance between split line segments to show measurement text)
 *
 * @see ADR-048: Hardcoded Values Centralization
 * @see BaseEntityRenderer.renderSplitLineWithGap()
 * @since 2027-01-27
 */
export const RENDER_GEOMETRY = {
  /**
   * Gap size in pixels for split lines (distance measurement preview)
   * Used when rendering lines/segments with inline distance text
   *
   * USAGE: Preview mode shows split line with 30px gap in center for text
   * STANDARD: AutoCAD dimension lines use similar gap patterns
   */
  SPLIT_LINE_GAP: 30,

  /**
   * 🏢 ADR-124: Dot radius in pixels for yellow measurement dots
   * Used when rendering endpoint/center dots on entities (Arc, Ellipse, Line)
   *
   * USAGE: Yellow dots at entity endpoints, centers, and axis points
   * STANDARD: Visual indicator size consistent across all entity renderers
   */
  DOT_RADIUS: 4,

  // ────────────────────────────────────────────
  // 🏢 ADR-140: ANGLE MEASUREMENT VISUALIZATION
  // ────────────────────────────────────────────

  /**
   * Arc radius in screen pixels for angle indicator visualization
   * Used in: AngleMeasurementRenderer, PreviewRenderer
   *
   * USAGE: Visual arc showing angle span from vertex point
   * STANDARD: AutoCAD dimension arc radius (consistent 40px screen size)
   */
  ANGLE_ARC_RADIUS: 40,

  /**
   * Text distance in screen pixels for angle label positioning
   * Used in: AngleMeasurementRenderer, PreviewRenderer
   *
   * USAGE: Positions angle text (e.g., "45.0°") on bisector line
   * STANDARD: AutoCAD dimension text placement (50px from vertex)
   */
  ANGLE_TEXT_DISTANCE: 50,
} as const;

// ============================================
// 🏢 ADR-091: TEXT LABEL OFFSETS (2026-01-31)
// ============================================

/**
 * 🏢 ENTERPRISE: Text Label Positioning Offsets
 *
 * Centralized vertical offsets for multi-line text labels in entity renderers.
 * Used for center measurements (area, perimeter, dimensions).
 *
 * Pattern: AutoCAD DIMTAD / ISO 129 Dimension Text Positioning
 *
 * LAYOUT (4-line example - Ellipse):
 *   Line 1: y - MULTI_LINE_OUTER (30px)  ← "Ma: X.XX"
 *   Line 2: y - TWO_LINE (10px)          ← "Mi: X.XX"
 *   Line 3: y + TWO_LINE (10px)          ← "E: X.XX"
 *   Line 4: y + MULTI_LINE_OUTER (30px)  ← "Περ: X.XX"
 *
 * @see ADR-091: Centralized Text Label Offsets
 * @since 2026-01-31
 */
export const TEXT_LABEL_OFFSETS = {
  /**
   * Standard two-line vertical spacing (pixels)
   * Used for: Rectangle, Polyline (Area + Perimeter)
   *
   * LAYOUT:
   *   Line 1: y - 10  ← "Ε: X.XX"
   *   Line 2: y + 10  ← "Περ: X.XX"
   */
  TWO_LINE: 10,

  /**
   * Multi-line outer vertical spacing (pixels)
   * Used for: Ellipse (4 lines), Arc (3 lines)
   *
   * LAYOUT (Arc - 3 lines):
   *   Line 1: y - 30  ← "R: X.XX"
   *   Line 2: y - 10  ← "Angle"
   *   Line 3: y + 10  ← "L: X.XX"
   */
  MULTI_LINE_OUTER: 30,

  /**
   * Tooltip/readout horizontal offset (pixels)
   * Used for: Ghost entity coordinate readout
   */
  TOOLTIP_HORIZONTAL: 10,

  /**
   * Tooltip/readout vertical offset (pixels)
   * Used for: Ghost entity coordinate readout
   */
  TOOLTIP_VERTICAL: 10,

  /**
   * Measurement text vertical offset (pixels)
   * Used for: Distance labels above lines (non-preview mode)
   * @see phase-text-utils.ts - renderDistanceTextPhaseAware()
   */
  MEASUREMENT_VERTICAL: 20,

  /**
   * Origin marker extra visibility margin (pixels)
   * Used for: Origin crosshair visibility check with label space
   * @see OriginMarkersRenderer.ts - render()
   */
  ORIGIN_LABEL_MARGIN: 50,

  /**
   * 🏢 ADR-124: Circle/Center label vertical offset (pixels)
   * Used for: Circle diameter/radius labels, snap mode indicator tooltip
   * Positions label above the center point or cursor
   *
   * LAYOUT:
   *   Label: y - 25  ← "D: X.XX" or snap type
   *   Center: y = 0  ← Circle center or cursor position
   *
   * @see CircleRenderer.ts - renderPreviewCircleWithMeasurements()
   * @see SnapModeIndicator.tsx - tooltip positioning
   */
  CIRCLE_LABEL: 25,

  // ────────────────────────────────────────────
  // 🏢 ADR-139: LABEL BOX DIMENSIONS (2026-02-01)
  // ────────────────────────────────────────────

  /**
   * Standard label box padding (pixels)
   * Used for: Ghost readouts, distance labels, entity count labels
   *
   * STANDARD: 4px padding provides compact but readable labels
   * @see ghost-entity-renderer.ts - entity count & coordinate readout
   * @see distance-label-utils.ts - PREVIEW_LABEL_DEFAULTS
   */
  LABEL_BOX_PADDING: 4,

  /**
   * Overlay region label box padding (pixels)
   * Slightly larger (6px) for region name labels for better readability
   *
   * USAGE: Region polygon name labels in overlay-drawing.ts
   * @see overlay-drawing.ts - drawLabel()
   */
  OVERLAY_LABEL_PADDING: 6,

  /**
   * Standard label box height (pixels)
   * Used for: Ghost readouts, coordinate displays, entity count labels
   *
   * STANDARD: 16px height fits 10-12px fonts comfortably
   * @see ghost-entity-renderer.ts - all label backgrounds
   */
  LABEL_BOX_HEIGHT: 16,

  /**
   * Overlay region label box height (pixels)
   * Slightly larger (18px) for better readability of region names
   *
   * USAGE: Region polygon name labels in overlay-drawing.ts
   * @see overlay-drawing.ts - drawLabel()
   */
  OVERLAY_LABEL_HEIGHT: 18,

  /**
   * Entity count label Y offset (pixels)
   * Distance from center to top of background box
   *
   * USAGE: Ghost simplified box shows "X entities" label at center
   * @see ghost-entity-renderer.ts - renderSimplifiedGhost()
   */
  ENTITY_COUNT_OFFSET_Y: 8,

  /**
   * Coordinate readout Y offset (pixels)
   * Vertical offset for readout background box positioning
   *
   * USAGE: Delta coordinate readout during entity drag
   * @see ghost-entity-renderer.ts - renderCoordinateReadout()
   */
  READOUT_OFFSET_Y: 14,

  // ────────────────────────────────────────────
  // 🏢 ADR-141: ORIGIN MARKER OFFSETS (2026-02-01)
  // ────────────────────────────────────────────

  /**
   * Origin crosshair arm length (pixels)
   * Used for: Debug origin marker crosshair rendering
   *
   * USAGE: Crosshair extends ±15px from origin point
   * @see CalibrationGridRenderer.ts - renderOriginMarker()
   */
  ORIGIN_CROSSHAIR_ARM: 15,

  /**
   * Origin label line spacing (pixels)
   * Used for: Multi-line debug labels at origin
   *
   * USAGE: Second line of label positioned 15px below first
   * @see OriginMarkersRenderer.ts, OriginMarkersDebugOverlay.ts
   */
  ORIGIN_LABEL_LINE_SPACING: 15,

  /**
   * Origin "O" label horizontal gap (pixels)
   * Used for: Positioning "O" marker label
   *
   * USAGE: "O" label positioned (markerSize + 15)px left of origin
   * @see OriginMarkersRenderer.ts, OriginMarkersDebugOverlay.ts
   */
  ORIGIN_LABEL_HORIZONTAL_GAP: 15,

  /**
   * Small label offset (pixels)
   * Used for: Fine positioning of labels near markers
   *
   * USAGE: 5px offset for label positioning adjustments
   * @see OriginMarkersRenderer.ts, CalibrationGridRenderer.ts
   */
  LABEL_FINE_OFFSET: 5,

  // ────────────────────────────────────────────
  // 🏢 ADR-141: DYNAMIC INPUT CURSOR OFFSETS
  // ────────────────────────────────────────────

  /**
   * Dynamic input horizontal offset from cursor (pixels)
   * Used for: Positioning dynamic input overlay
   *
   * USAGE: Input positioned 15px right of cursor
   * @see useDynamicInputLayout.ts
   */
  CURSOR_OFFSET_X: 15,

  /**
   * Dynamic input vertical offset from cursor (pixels)
   * Used for: Positioning dynamic input overlay base
   *
   * USAGE: Input base positioned 15px above cursor
   * @see useDynamicInputLayout.ts
   */
  CURSOR_OFFSET_Y: 15,

  // ────────────────────────────────────────────
  // 🏢 ADR-153: X/Y AXIS LABEL POSITIONING (2026-02-01)
  // ────────────────────────────────────────────

  /**
   * X-axis label right margin from viewport edge (pixels)
   * Used for: Positioning "X" label on horizontal axis line
   *
   * PATTERN: ctx.fillText('X', viewport.width - X_AXIS_LABEL_RIGHT_MARGIN, ...)
   * @see OriginMarkersRenderer.ts, OriginMarkersDebugOverlay.ts
   */
  X_AXIS_LABEL_RIGHT_MARGIN: 10,

  /**
   * X-axis label bottom offset from axis line (pixels)
   * Used for: Vertical positioning of "X" label above horizontal axis
   *
   * PATTERN: ctx.fillText('X', ..., originScreenY - X_AXIS_LABEL_BOTTOM_OFFSET)
   * @see OriginMarkersRenderer.ts, OriginMarkersDebugOverlay.ts
   */
  X_AXIS_LABEL_BOTTOM_OFFSET: 5,

  /**
   * Y-axis label left offset from axis line (pixels)
   * Used for: Horizontal positioning of "Y" label right of vertical axis
   *
   * PATTERN: ctx.fillText('Y', originScreenX + Y_AXIS_LABEL_LEFT_OFFSET, ...)
   * @see OriginMarkersRenderer.ts, OriginMarkersDebugOverlay.ts
   */
  Y_AXIS_LABEL_LEFT_OFFSET: 5,

  /**
   * Y-axis label top margin from viewport edge (pixels)
   * Used for: Vertical positioning of "Y" label near top of viewport
   *
   * PATTERN: ctx.fillText('Y', ..., Y_AXIS_LABEL_TOP_MARGIN)
   * @see OriginMarkersRenderer.ts, OriginMarkersDebugOverlay.ts
   */
  Y_AXIS_LABEL_TOP_MARGIN: 10,
} as const;

// ============================================
// 🏢 ADR-107: UI SIZE DEFAULTS (2026-01-31)
// ============================================

/**
 * 🏢 ENTERPRISE: UI Size Default Values
 *
 * Centralized fallback values for UI elements when settings are not provided.
 * Eliminates ~20 hardcoded `|| 10` / `?? 10` patterns across 4 files.
 *
 * SEMANTIC CATEGORIES:
 * - Ruler Typography: Font sizes for ruler labels
 * - Ruler Measurements: Tick mark dimensions
 * - Grips & Interaction: Selection aperture sizes
 * - Text Entity Bounds: Fallback heights for bounds calculation
 *
 * Pattern: AutoCAD DIMSCALE / Bentley MicroStation UI Defaults
 *
 * @see ADR-107: UI Size Defaults Centralization
 * @since 2026-01-31
 */
export const UI_SIZE_DEFAULTS = {
  // ────────────────────────────────────────────
  // RULER TYPOGRAPHY
  // ────────────────────────────────────────────

  /**
   * Default ruler font size (px)
   * Used when settings.fontSize is not provided
   * Standard for CAD ruler annotations
   */
  RULER_FONT_SIZE: 10,

  /**
   * Default ruler units font size (px)
   * Used when settings.unitsFontSize is not provided
   * Typically same as RULER_FONT_SIZE for consistency
   */
  RULER_UNITS_FONT_SIZE: 10,

  // ────────────────────────────────────────────
  // RULER MEASUREMENTS
  // ────────────────────────────────────────────

  /**
   * Default major tick mark length (px)
   * Used when settings.majorTickLength is not provided
   * Standard 10px for visibility and CAD conventions
   */
  MAJOR_TICK_LENGTH: 10,

  // ────────────────────────────────────────────
  // GRIPS & INTERACTION
  // ────────────────────────────────────────────

  /**
   * Default grip selection aperture size (px)
   * Used when settings.apertureSize is not provided
   * AutoCAD standard: APERTURE system variable default
   */
  APERTURE_SIZE: 10,

  /**
   * Default grip point size (px)
   * Used when settings.gripSize is not provided
   * AutoCAD standard: GRIPSIZE system variable default
   */
  GRIP_SIZE: 8,

  /**
   * Default pick box size (px)
   * Used when settings.pickBoxSize is not provided
   * AutoCAD standard: PICKBOX system variable default
   */
  PICK_BOX_SIZE: 3,

  // ────────────────────────────────────────────
  // TEXT ENTITY BOUNDS
  // ────────────────────────────────────────────

  /**
   * Default text height for bounds calculation (drawing units)
   * Used when entity.height is not provided
   * Provides reasonable bounding box for text entities
   */
  TEXT_HEIGHT_FALLBACK: 10,
} as const;

/**
 * 🏢 ENTERPRISE: UI Size Defaults type
 */
export type UISizeDefaults = typeof UI_SIZE_DEFAULTS;

// ============================================================================
// 🏢 ADR-107: TEXT METRICS RATIOS (Typography Standards)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized Text Metrics Ratios
 *
 * Typography constants for text measurement and positioning.
 * Based on standard font metrics (typical Western fonts).
 *
 * Eliminates 27+ hardcoded font/text metrics multipliers across 16 files.
 *
 * Reference: CSS font-size-adjust, OpenType OS/2 metrics
 *
 * @see ADR-107: Text Metrics Constants Centralization
 * @since 2026-01-31
 */
export const TEXT_METRICS_RATIOS = {
  // ────────────────────────────────────────────
  // CHARACTER WIDTH ESTIMATION
  // ────────────────────────────────────────────

  /** Average character width for monospace fonts (60% of fontSize) */
  CHAR_WIDTH_MONOSPACE: 0.6,

  /** Average character width for proportional fonts (55% of fontSize) */
  CHAR_WIDTH_PROPORTIONAL: 0.55,

  /** Alternative wider estimate for text bounds (70% of fontSize) */
  CHAR_WIDTH_WIDE: 0.7,

  // ────────────────────────────────────────────
  // VERTICAL METRICS (Ascent/Descent)
  // ────────────────────────────────────────────

  /** Ascender height ratio - top of letters above baseline (80% of fontSize) */
  ASCENT_RATIO: 0.8,

  /** Descender height ratio - bottom of letters below baseline (20% of fontSize) */
  DESCENT_RATIO: 0.2,

  // ────────────────────────────────────────────
  // SUPERSCRIPT/SUBSCRIPT
  // ────────────────────────────────────────────

  /** Font size reduction for super/subscript (75% of normal) */
  SCRIPT_SIZE_RATIO: 0.75,

  /** Superscript vertical offset - raise above baseline (30% of fontSize) */
  SUPERSCRIPT_OFFSET: 0.3,

  /** Subscript vertical offset - drop below baseline (20% of fontSize) */
  SUBSCRIPT_OFFSET: 0.2,

  // ────────────────────────────────────────────
  // TEXT DECORATIONS
  // ────────────────────────────────────────────

  /** Underline vertical position below text (15% of fontSize) */
  UNDERLINE_OFFSET: 0.15,

  /** Strikethrough vertical position (5% above baseline) */
  STRIKETHROUGH_OFFSET: 0.05,

  /** Decoration line width ratio (5% of fontSize) */
  DECORATION_LINE_WIDTH: 0.05,

  // ────────────────────────────────────────────
  // BOLD/SCRIPT ADJUSTMENTS
  // ────────────────────────────────────────────

  /** Bold text width multiplier (115% of normal) */
  BOLD_WIDTH_MULTIPLIER: 1.15,

  /** Script spacing multiplier (120% for super/subscript) */
  SCRIPT_SPACING_MULTIPLIER: 1.2,
} as const;

/**
 * 🏢 ENTERPRISE: Text Metrics Ratios type
 */
export type TextMetricsRatios = typeof TEXT_METRICS_RATIOS;

// ============================================
// HIT TESTING CONFIGURATION
// ============================================

/**
 * Hit testing configuration for text entities
 *
 * RATIONALE:
 * - TOLERANCE: 5px provides comfortable click target
 * - PADDING: Additional padding around text bounds
 */
export const TEXT_HIT_TESTING = {
  /**
   * Default hit testing tolerance in pixels
   * Allows clicking slightly outside text bounds
   */
  DEFAULT_TOLERANCE: 5,

  /**
   * Minimum hit area width in pixels
   * Ensures very short text is still clickable
   */
  MIN_HIT_WIDTH: 10,

  /**
   * Minimum hit area height in pixels
   * Ensures small text is still clickable
   */
  MIN_HIT_HEIGHT: 10,
} as const;

// ============================================
// ANNOTATION SCALING (CAD STANDARD)
// ============================================

/**
 * 🏢 ENTERPRISE: Annotation Scaling Configuration
 *
 * CAD Industry Standard: Text/annotations use different scaling than geometry
 * to remain readable at all zoom levels.
 *
 * RATIONALE:
 * - In AutoCAD/BricsCAD, annotations have "paper space" scaling
 * - Text height in drawing units is scaled differently than geometry
 * - This ensures text remains readable regardless of drawing extent
 *
 * @see AutoCAD Annotation Scaling
 * @see ISO 128 - Technical drawing dimensioning
 */
export const ANNOTATION_SCALING = {
  /**
   * Minimum text height as ratio of viewport height
   * 1.5% of viewport = ~12px on 800px viewport
   * This ensures text is always readable relative to screen
   */
  MIN_HEIGHT_VIEWPORT_RATIO: 0.015,

  /**
   * Annotation scale boost factor
   * Multiplies text height to make it more prominent
   * 100.0 = text renders proportionally to geometry
   * (Increased from 4.0 - was too small, dynamicMin always dominated)
   *
   * CALCULATION: For fontSize=0.132m at scale=5:
   * - With 4.0:   0.132 × 5 × 4   = 2.6px (< dynamicMin ~15px) ❌
   * - With 100.0: 0.132 × 5 × 100 = 66px (> dynamicMin ~15px) ✅
   */
  SCALE_BOOST_FACTOR: 100.0,

  /**
   * Absolute minimum in pixels (fallback)
   * Never go below this regardless of viewport size
   */
  ABSOLUTE_MIN_PIXELS: 10,

  /**
   * Enable viewport-based dynamic minimum
   * When true, MIN_HEIGHT_VIEWPORT_RATIO is used
   * When false, falls back to TEXT_SIZE_LIMITS.MIN_READABLE_SIZE
   */
  USE_DYNAMIC_MINIMUM: true,

  /**
   * Enable annotation scale boost
   * When true, text is multiplied by SCALE_BOOST_FACTOR
   */
  USE_SCALE_BOOST: true,
} as const;

// ============================================
// RENDERING BEHAVIOR
// ============================================

/**
 * Text rendering behavior flags
 *
 * RATIONALE:
 * - APPLY_MIN_SIZE: true enables minimum size enforcement
 * - SCALE_WITH_ZOOM: true for CAD-standard behavior
 * - ANTI_ALIAS: true for smooth text rendering
 */
export const TEXT_RENDERING_BEHAVIOR = {
  /**
   * Apply minimum readable size constraint
   * When true, text never renders smaller than MIN_READABLE_SIZE
   */
  APPLY_MIN_SIZE: true,

  /**
   * Apply maximum screen size constraint
   * When true, text never renders larger than MAX_SCREEN_SIZE
   */
  APPLY_MAX_SIZE: true,

  /**
   * Scale text with zoom level
   * When true, text size changes with canvas zoom
   */
  SCALE_WITH_ZOOM: true,

  /**
   * Enable text anti-aliasing
   * Default canvas behavior, but can be toggled for performance
   */
  ANTI_ALIAS: true,
} as const;

// ============================================
// COMBINED CONFIGURATION
// ============================================

/**
 * Complete text rendering configuration
 *
 * USE THIS for full configuration objects
 */
export const TEXT_RENDERING_CONFIG = {
  sizes: TEXT_SIZE_LIMITS,
  metrics: CHARACTER_METRICS,
  fonts: TEXT_FONTS,
  hitTesting: TEXT_HIT_TESTING,
  behavior: TEXT_RENDERING_BEHAVIOR,
  annotationScaling: ANNOTATION_SCALING,
  // 🏢 ADR-044: Canvas line widths
  lineWidths: RENDER_LINE_WIDTHS,
} as const;

// ============================================
// TYPE EXPORTS
// ============================================

/**
 * Text rendering configuration type
 */
export type TextRenderingConfig = typeof TEXT_RENDERING_CONFIG;

/**
 * Text size limits type
 */
export type TextSizeLimits = typeof TEXT_SIZE_LIMITS;

/**
 * Character metrics type
 */
export type CharacterMetrics = typeof CHARACTER_METRICS;

/**
 * Text fonts configuration type
 */
export type TextFontsConfig = typeof TEXT_FONTS;

// ============================================
// 🏢 ADR-083: LINE DASH PATTERNS (2026-01-31)
// ============================================

/**
 * 🏢 ENTERPRISE: Line Dash Pattern Configuration
 *
 * Centralized dash patterns for Canvas 2D ctx.setLineDash().
 * Eliminates 45+ hardcoded dash arrays across 16 files.
 *
 * Pattern: AutoCAD LTSCALE / ISO 128 Line Types
 *
 * @see ADR-083: Centralized Line Dash Patterns
 * @since 2026-01-31
 */
export const LINE_DASH_PATTERNS = {
  // ────────────────────────────────────────────
  // CORE LINE TYPES (ISO 128 / AutoCAD Standard)
  // ────────────────────────────────────────────

  /** Solid line - no dashes */
  SOLID: [] as number[],

  /** Standard dashed line [5, 5] */
  DASHED: [5, 5] as const,

  /** Dotted line [2, 4] */
  DOTTED: [2, 4] as const,

  /** Dash-dot (center line) [8, 4, 2, 4] */
  DASH_DOT: [8, 4, 2, 4] as const,

  // ────────────────────────────────────────────
  // SPECIAL PURPOSE
  // ────────────────────────────────────────────

  /** Selection highlight [5, 5] */
  SELECTION: [5, 5] as const,

  /** Ghost entity preview [4, 4] */
  GHOST: [4, 4] as const,

  /** Hover state [12, 6] - longer dash for emphasis */
  HOVER: [12, 6] as const,

  /** Locked/disabled state [4, 4] */
  LOCKED: [4, 4] as const,

  /** Construction/temporary lines [8, 4] */
  CONSTRUCTION: [8, 4] as const,

  /** Arc preview lines [3, 3] */
  ARC: [3, 3] as const,

  /** Text bounding box [2, 2] */
  TEXT_BOUNDING: [2, 2] as const,

  // ────────────────────────────────────────────
  // CURSOR STYLES (match CursorRenderer)
  // ────────────────────────────────────────────

  /** Cursor dashed style [6, 6] */
  CURSOR_DASHED: [6, 6] as const,

  /** Cursor dotted style [2, 4] */
  CURSOR_DOTTED: [2, 4] as const,

  /** Cursor dash-dot style [8, 4, 2, 4] */
  CURSOR_DASH_DOT: [8, 4, 2, 4] as const,
} as const;

/**
 * 🏢 ENTERPRISE: Line dash pattern type
 * Union of all available dash patterns
 */
export type LineDashPattern = (typeof LINE_DASH_PATTERNS)[keyof typeof LINE_DASH_PATTERNS];

/**
 * 🏢 ENTERPRISE: Apply line dash pattern to canvas context
 * Convenience wrapper for ctx.setLineDash()
 *
 * @param ctx - Canvas 2D rendering context
 * @param pattern - Dash pattern from LINE_DASH_PATTERNS
 */
export function applyLineDash(
  ctx: CanvasRenderingContext2D,
  pattern: LineDashPattern
): void {
  ctx.setLineDash([...pattern]);
}

/**
 * 🏢 ENTERPRISE: Reset line dash to solid
 * Convenience wrapper for ctx.setLineDash([])
 *
 * @param ctx - Canvas 2D rendering context
 */
export function resetLineDash(ctx: CanvasRenderingContext2D): void {
  ctx.setLineDash(LINE_DASH_PATTERNS.SOLID);
}

/**
 * 🏢 ADR-083: Scale dash pattern for zoom-aware rendering
 *
 * Multiplies each value in the pattern by a scale factor.
 * Used for line completion styles where dash size varies with zoom.
 *
 * @param pattern - Base dash pattern from LINE_DASH_PATTERNS
 * @param scale - Scale factor (typically from dashScale setting)
 * @returns New array with scaled values
 *
 * @example
 * scaleDashPattern(LINE_DASH_PATTERNS.CONSTRUCTION, 2)
 * // Returns [16, 8] (original [8, 4] * 2)
 */
export function scaleDashPattern(
  pattern: readonly number[],
  scale: number
): number[] {
  return pattern.map(v => v * scale);
}

// ============================================
// 🏢 ADR-141: UI TEXT INPUT CONSTRAINTS (2026-02-01)
// ============================================

/**
 * 🏢 ENTERPRISE: UI Text Input Size Constraints
 *
 * Limits for user-adjustable font sizes in settings panels.
 * Different from TEXT_SIZE_LIMITS which is for canvas rendering.
 *
 * @see TextSettings.tsx - Font size +/- buttons
 * @see ADR-141: UI Text Input Constraints Centralization
 * @since 2026-02-01
 */
export const UI_TEXT_INPUT_CONSTRAINTS = {
  /** Minimum font size for user input (pixels) - Readable threshold */
  FONT_SIZE_MIN: 6,

  /** Maximum font size for user input (pixels) - Practical limit */
  FONT_SIZE_MAX: 200,
} as const;

// ============================================
// 🏢 ADR-141: ARC LABEL POSITIONING (2026-02-01)
// ============================================

/**
 * 🏢 ENTERPRISE: Arc Label Positioning Constants
 *
 * Constants for positioning angle labels on arc measurements.
 * Used in polyline/polygon angle annotations.
 *
 * @see BaseEntityRenderer.ts - renderAngleAtVertex()
 * @see ADR-141: Arc Label Positioning Centralization
 * @since 2026-02-01
 */
export const ARC_LABEL_POSITIONING = {
  /**
   * Arc label distance ratio (66% of arc radius)
   * Positions the angle text at 2/3 of the arc radius from vertex
   *
   * RATIONALE: 0.66 provides good readability without overlapping the arc
   * Industry standard for dimension text placement
   */
  OFFSET_RATIO: 0.66,

  /**
   * Minimum arc label offset in pixels
   * Fallback when arc radius is too small
   *
   * RATIONALE: 6px ensures text doesn't overlap with vertex point
   */
  MIN_OFFSET_PX: 6,
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * 🏢 ENTERPRISE: Calculate dynamic minimum text size based on viewport
 *
 * Uses annotation scaling to ensure text remains readable at all zoom levels.
 * Returns the larger of: viewport-based minimum or absolute minimum.
 *
 * @param viewportHeight - Viewport height in pixels (optional)
 * @returns Minimum text height in pixels
 */
export function calculateDynamicMinimum(viewportHeight?: number): number {
  if (!ANNOTATION_SCALING.USE_DYNAMIC_MINIMUM || !viewportHeight) {
    return TEXT_SIZE_LIMITS.MIN_READABLE_SIZE;
  }

  const viewportBasedMin = viewportHeight * ANNOTATION_SCALING.MIN_HEIGHT_VIEWPORT_RATIO;
  return Math.max(viewportBasedMin, ANNOTATION_SCALING.ABSOLUTE_MIN_PIXELS);
}

/**
 * 🏢 ENTERPRISE: Calculate effective screen height with annotation scaling
 *
 * MAJOR FIX: Implements CAD-standard annotation scaling
 * - Text is boosted by SCALE_BOOST_FACTOR for better visibility
 * - Minimum size is dynamic based on viewport (not fixed 8px)
 * - Ensures text remains proportional to drawing at all zoom levels
 *
 * @param textHeight - Text height in drawing units
 * @param scale - Current canvas scale (zoom level)
 * @param viewportHeight - Optional viewport height for dynamic minimum
 * @returns Effective screen height in pixels
 */
export function calculateEffectiveScreenHeight(
  textHeight: number,
  scale: number,
  viewportHeight?: number
): number {
  // 🏢 ENTERPRISE: Apply annotation scale boost for better visibility
  let screenHeight = textHeight * scale;

  if (ANNOTATION_SCALING.USE_SCALE_BOOST) {
    screenHeight *= ANNOTATION_SCALING.SCALE_BOOST_FACTOR;
  }

  let effectiveHeight = screenHeight;

  // 🏢 ENTERPRISE: Apply dynamic minimum based on viewport
  if (TEXT_RENDERING_BEHAVIOR.APPLY_MIN_SIZE) {
    const dynamicMin = calculateDynamicMinimum(viewportHeight);
    effectiveHeight = Math.max(effectiveHeight, dynamicMin);
  }

  // Apply maximum size constraint
  if (TEXT_RENDERING_BEHAVIOR.APPLY_MAX_SIZE) {
    effectiveHeight = Math.min(effectiveHeight, TEXT_SIZE_LIMITS.MAX_SCREEN_SIZE);
  }

  return effectiveHeight;
}

/**
 * Estimate text width for hit testing
 *
 * ENTERPRISE: Uses character metrics for bounding box calculation
 *
 * @param text - Text content
 * @param screenHeight - Text height in screen pixels
 * @returns Estimated width in pixels
 */
export function estimateTextWidth(text: string, screenHeight: number): number {
  return text.length * screenHeight * CHARACTER_METRICS.WIDTH_RATIO;
}

/**
 * Get text height with fallback chain
 *
 * ENTERPRISE: Follows CAD standard fallback priority
 * 1. fontSize (canonical)
 * 2. height (legacy)
 * 3. DEFAULT_HEIGHT (fallback)
 *
 * @param fontSize - Optional fontSize from entity
 * @param height - Optional height from entity (legacy)
 * @returns Valid text height in drawing units
 */
export function getTextHeightWithFallback(
  fontSize?: number,
  height?: number
): number {
  // Priority 1: fontSize (canonical)
  if (typeof fontSize === 'number' && fontSize > TEXT_SIZE_LIMITS.MIN_VALID_HEIGHT) {
    return fontSize;
  }

  // Priority 2: height (legacy/backward compatibility)
  if (typeof height === 'number' && height > TEXT_SIZE_LIMITS.MIN_VALID_HEIGHT) {
    return height;
  }

  // Default: CAD standard default text height
  return TEXT_SIZE_LIMITS.DEFAULT_HEIGHT;
}

/**
 * Build CSS font string for canvas rendering
 *
 * @param screenHeight - Text height in screen pixels
 * @param fontFamily - Optional font family (defaults to Arial)
 * @returns CSS font string for canvas.font property
 */
export function buildCanvasFont(
  screenHeight: number,
  fontFamily: string = TEXT_FONTS.DEFAULT_FAMILY
): string {
  return `${screenHeight}px ${fontFamily}`;
}
