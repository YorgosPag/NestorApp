/**
 * TRANSFORM CONFIGURATION - UNIFIED CONSTANTS
 * ============================================
 *
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ: Όλα τα transform/zoom/pan constants σε ένα μέρος
 * ✅ ENTERPRISE-GRADE: CAD-standard values
 * ✅ ZERO CONFLICTS: Single source of truth
 *
 * @see MASTER_CONSOLIDATION_ROADMAP.md - Phase 1.3
 * @created 2025-10-04
 */

// ============================================
// TRANSFORM SCALE LIMITS
// ============================================

/**
 * Scale limits για canvas transformation
 *
 * RATIONALE:
 * - MIN_SCALE: 0.01 (1%) - Wide enough για μεγάλα buildings/sites
 * - MAX_SCALE: 1000 (100,000%) - Επαρκής για millimeter-level CAD precision
 *
 * DECISION: Χρησιμοποιούμε τα πιο wide limits από useCanvasTransformState
 * γιατί δίνουν μεγαλύτερη ευελιξία χωρίς performance issues.
 */
export const TRANSFORM_SCALE_LIMITS = {
  /** Minimum scale (1% - can see very large sites/buildings) */
  MIN_SCALE: 0.01,

  /** Maximum scale (100,000% - millimeter-level CAD precision) */
  MAX_SCALE: 1000,

  /** Default/initial scale (100% - 1:1 view) */
  DEFAULT_SCALE: 1,
} as const;

/**
 * Practical zoom limits για UI controls
 *
 * RATIONALE:
 * - Οι UI controls (toolbar buttons) χρησιμοποιούν πιο conservative limits
 * - Οι users μπορούν να φτάσουν extreme zooms μέσω mouse wheel αν χρειάζεται
 * - Αυτό προστατεύει από accidental extreme zooms
 */
export const UI_ZOOM_LIMITS = {
  /** Minimum scale για UI controls (10%) */
  MIN_SCALE: 0.1,

  /** Maximum scale για UI controls (5000%) */
  MAX_SCALE: 50,
} as const;

// ============================================
// OFFSET LIMITS
// ============================================

/**
 * Offset limits για pan operations
 *
 * RATIONALE:
 * - ±1,000,000 pixels είναι υπεραρκετά για οποιοδήποτε realistic drawing
 * - Προστατεύει από accidental infinite panning
 */
export const TRANSFORM_OFFSET_LIMITS = {
  /** Minimum offset (-1,000,000px) */
  MIN_OFFSET: -1000000,

  /** Maximum offset (+1,000,000px) */
  MAX_OFFSET: 1000000,

  /** Default offsetX (0 - centered) */
  DEFAULT_OFFSET_X: 0,

  /** Default offsetY (0 - centered) */
  DEFAULT_OFFSET_Y: 0,
} as const;

// ============================================
// ZOOM FACTORS
// ============================================

/**
 * Zoom factors για διάφορα input methods
 *
 * INDUSTRY STANDARDS:
 * - AutoCAD: ~1.1 per wheel step
 * - Blender: ~1.1 per wheel step
 * - Figma: ~1.1 per wheel step
 *
 * 1.1 = 10% zoom change (smooth και predictable)
 */
export const ZOOM_FACTORS = {
  // === MOUSE WHEEL ===
  /** Normal wheel zoom in (10% increase) */
  WHEEL_IN: 1.1,

  /** Normal wheel zoom out (10% decrease) */
  WHEEL_OUT: 0.9,

  // === CTRL + WHEEL (ENTERPRISE: Faster zoom) ===
  /** Ctrl+Wheel zoom in (20% increase - 2x faster) */
  CTRL_WHEEL_IN: 1.2,

  /** Ctrl+Wheel zoom out (20% decrease - 2x faster) */
  CTRL_WHEEL_OUT: 0.8,

  // === KEYBOARD ===
  /** Keyboard zoom in (+/= keys - 10% increase, same as wheel) */
  KEYBOARD_IN: 1.1,

  /** Keyboard zoom out (- key - 10% decrease, same as wheel) */
  KEYBOARD_OUT: 1 / 1.1,

  // === UI BUTTONS ===
  /** Toolbar button zoom in */
  BUTTON_IN: 1.2,

  /** Toolbar button zoom out */
  BUTTON_OUT: 0.8,

  // === SPECIAL ===
  /** Fit-to-view padding in pixels */
  FIT_PADDING: 100,

  /** Minimum window size for window zoom */
  WINDOW_MIN_SIZE: 10,
} as const;

// ============================================
// PAN CONSTANTS
// ============================================

/**
 * Pan/scroll speeds για διάφορα input methods
 */
export const PAN_SPEEDS = {
  /** Keyboard arrow key pan speed (pixels per key press) */
  KEYBOARD: 50,

  /** Shift+Arrow key pan speed (faster - 5x) */
  KEYBOARD_FAST: 250,

  /** Mouse drag pan speed multiplier */
  MOUSE_DRAG: 1,

  /** Trackpad/touchpad pan speed multiplier */
  TRACKPAD: 1,
} as const;

// ============================================
// ANIMATION SETTINGS
// ============================================

/**
 * Transform animation settings
 *
 * ENTERPRISE: Animations disabled by default για CAD apps
 * (Users prefer instant response)
 */
export const TRANSFORM_ANIMATION = {
  /** Enable/disable animations (default: false για CAD precision) */
  ENABLED: false,

  /** Animation duration in milliseconds */
  DURATION: 200,

  /** CSS easing function */
  EASING: 'ease-out' as const,

  /** Number of animation steps/frames */
  STEPS: 10,
} as const;

// ============================================
// BEHAVIOR FLAGS
// ============================================

/**
 * Transform behavior configuration
 */
export const TRANSFORM_BEHAVIOR = {
  /** Zoom to cursor position (vs. center) */
  ZOOM_TO_CURSOR: true,

  /** Restrict transform to content bounds */
  RESTRICT_TO_CONTENT: false,

  /** Invert zoom direction (non-standard, default: false) */
  INVERT_ZOOM: false,

  /** Invert pan direction (non-standard, default: false) */
  INVERT_PAN: false,
} as const;

// ============================================
// PRECISION & THRESHOLDS
// ============================================

/**
 * Precision thresholds για transform comparisons
 *
 * RATIONALE:
 * - Floating-point comparisons χρειάζονται tolerance
 * - Αυτά τα thresholds προσδιορίζουν "effectively equal"
 */
export const TRANSFORM_PRECISION = {
  /** Scale comparison threshold */
  SCALE_EPSILON: 0.01,

  /** Offset comparison threshold (pixels) */
  OFFSET_EPSILON: 5,

  /** Angle comparison threshold (degrees) */
  ROTATION_EPSILON: 0.1,
} as const;

// ============================================
// VIEWPORT DEFAULTS
// ============================================

/**
 * Default viewport dimensions
 */
export const VIEWPORT_DEFAULTS = {
  /** Default viewport width */
  WIDTH: 800,

  /** Default viewport height */
  HEIGHT: 600,

  /** Default padding for fit operations */
  PADDING: 50,
} as const;

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

/**
 * Keyboard shortcuts για zoom/pan operations
 */
export const TRANSFORM_KEYS = {
  /** Zoom in keys */
  ZOOM_IN: ['+', '='] as const,

  /** Zoom out keys */
  ZOOM_OUT: ['-'] as const,

  /** Fit to view keys */
  FIT_TO_VIEW: ['0'] as const,

  /** Reset transform keys */
  RESET: ['r'] as const,

  /** Previous zoom keys */
  PREVIOUS: ['p'] as const,

  /** Pan up keys */
  PAN_UP: ['ArrowUp'] as const,

  /** Pan down keys */
  PAN_DOWN: ['ArrowDown'] as const,

  /** Pan left keys */
  PAN_LEFT: ['ArrowLeft'] as const,

  /** Pan right keys */
  PAN_RIGHT: ['ArrowRight'] as const,
} as const;

// ============================================
// HISTORY SETTINGS
// ============================================

/**
 * Transform history configuration
 */
export const TRANSFORM_HISTORY = {
  /** Maximum number of history entries */
  MAX_SIZE: 50,

  /** Enable/disable history tracking */
  ENABLED: true,
} as const;

// ============================================
// COMBINED CONFIGS
// ============================================

/**
 * Complete transform configuration
 *
 * USE THIS για full configuration objects
 */
export const TRANSFORM_CONFIG = {
  scale: TRANSFORM_SCALE_LIMITS,
  offset: TRANSFORM_OFFSET_LIMITS,
  zoom: ZOOM_FACTORS,
  pan: PAN_SPEEDS,
  animation: TRANSFORM_ANIMATION,
  behavior: TRANSFORM_BEHAVIOR,
  precision: TRANSFORM_PRECISION,
  viewport: VIEWPORT_DEFAULTS,
  keys: TRANSFORM_KEYS,
  history: TRANSFORM_HISTORY,
} as const;

// ============================================
// TYPE EXPORTS
// ============================================

/**
 * Transform configuration type
 */
export type TransformConfig = typeof TRANSFORM_CONFIG;

/**
 * Scale limits type
 */
export type ScaleLimits = typeof TRANSFORM_SCALE_LIMITS;

/**
 * Zoom factors type
 */
export type ZoomFactors = typeof ZOOM_FACTORS;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate scale value against limits
 */
export function validateScale(
  scale: number,
  limits: { min: number; max: number } = {
    min: TRANSFORM_SCALE_LIMITS.MIN_SCALE,
    max: TRANSFORM_SCALE_LIMITS.MAX_SCALE,
  }
): number {
  return Math.max(limits.min, Math.min(limits.max, scale));
}

/**
 * Validate offset value against limits
 */
export function validateOffset(offset: number): number {
  return Math.max(
    TRANSFORM_OFFSET_LIMITS.MIN_OFFSET,
    Math.min(TRANSFORM_OFFSET_LIMITS.MAX_OFFSET, offset)
  );
}

/**
 * Validate complete transform object
 */
export function validateTransform(transform: {
  scale: number;
  offsetX: number;
  offsetY: number;
}): {
  scale: number;
  offsetX: number;
  offsetY: number;
} {
  return {
    scale: validateScale(transform.scale),
    offsetX: validateOffset(transform.offsetX),
    offsetY: validateOffset(transform.offsetY),
  };
}

/**
 * Compare two scales with epsilon tolerance
 */
export function scalesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= TRANSFORM_PRECISION.SCALE_EPSILON;
}

/**
 * Compare two offsets with epsilon tolerance
 */
export function offsetsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= TRANSFORM_PRECISION.OFFSET_EPSILON;
}

/**
 * Compare two transforms with epsilon tolerances
 */
export function transformsEqual(
  a: { scale: number; offsetX: number; offsetY: number },
  b: { scale: number; offsetX: number; offsetY: number }
): boolean {
  return (
    scalesEqual(a.scale, b.scale) &&
    offsetsEqual(a.offsetX, b.offsetX) &&
    offsetsEqual(a.offsetY, b.offsetY)
  );
}
