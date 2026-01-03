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
