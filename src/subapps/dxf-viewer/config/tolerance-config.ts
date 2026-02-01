/**
 * TOLERANCE CONFIGURATION
 * Central configuration for all tolerance and precision settings
 */

// Basic tolerance settings (in pixels, unless stated otherwise)
export const TOLERANCE_CONFIG = {
  // Selection tolerances
  SELECTION_DEFAULT: 8,     // Default selection tolerance
  SELECTION_MIN: 2,         // Minimum selection tolerance
  SELECTION_MAX: 20,        // Maximum selection tolerance
  
  // Snap tolerances  
  SNAP_DEFAULT: 10,         // Default snap tolerance in pixels
  SNAP_PRECISION: 1e-10,    // High-precision snap tolerance (geometric calculations)
  
  // Hit testing
  HIT_TEST_DEFAULT: 8,      // Default hit test tolerance
  HIT_TEST_FALLBACK: 5,     // 🏢 ADR-105: Fallback tolerance for renderer hitTest methods
  HIT_TEST_RADIUS: 12,      // Hit test radius for visual elements
  
  // Grips and handles
  GRIP_APERTURE: 8,         // Default grip aperture size
  VERTEX_HANDLE_SIZE: 8,    // Size of vertex handles for editing
  
  // Calibration
  CALIBRATION: 2.0,         // Calibration tolerance for precise measurements
  
  // Geometry precision
  POLYLINE_PRECISION: 0.01, // Precision for polyline rendering
  
  // Marquee and lasso
  MARQUEE_MIN_SIZE: 3,      // Minimum pixels for valid marquee selection
  LASSO_MIN_POINTS: 3,      // Minimum points for valid lasso selection
} as const;

// Hover tolerances (scaled by zoom)
export interface HoverToleranceConfig {
  basePixels: number;
  scaleWithZoom: boolean;
}

export const HOVER_TOLERANCE_CONFIG: HoverToleranceConfig = {
  basePixels: 5,
  scaleWithZoom: true,
};

// Export convenient aliases for backward compatibility
export const DEFAULT_TOLERANCE = TOLERANCE_CONFIG.SELECTION_DEFAULT;
export const SNAP_TOLERANCE = TOLERANCE_CONFIG.SNAP_DEFAULT;
export const HIT_TEST_FALLBACK = TOLERANCE_CONFIG.HIT_TEST_FALLBACK; // 🏢 ADR-105
export const HIT_TEST_RADIUS_PX = TOLERANCE_CONFIG.HIT_TEST_RADIUS;
export const CALIB_TOLERANCE_PX = TOLERANCE_CONFIG.CALIBRATION;
export const VERTEX_HANDLE_SIZE = TOLERANCE_CONFIG.VERTEX_HANDLE_SIZE;
export const MIN_POLY_POINTS = 3;
export const MIN_POLY_AREA = 0.05;

// Utility function to convert tolerance based on zoom scale
export const getScaledTolerance = (baseTolerance: number, scale: number): number => {
  return baseTolerance / scale;
};

// ===== GEOMETRIC PRECISION CONSTANTS =====
// 🏢 ADR-079: Centralized epsilon values for geometric calculations (2026-01-31)

/**
 * 🎯 GEOMETRIC PRECISION CONSTANTS
 * Ultra-high precision values for line/circle intersections and point matching
 *
 * Used for:
 * - Line intersection calculations (denominator zero check)
 * - Circle-circle and line-circle intersections (duplicate point check)
 * - Vertex duplicate detection
 * - Point matching in snapping systems
 *
 * @example
 * import { GEOMETRY_PRECISION } from '../config/tolerance-config';
 * if (Math.abs(denominator) < GEOMETRY_PRECISION.DENOMINATOR_ZERO) return null;
 */
export const GEOMETRY_PRECISION = {
  /** Ultra-high precision for collinear points check (1e-10) */
  COLLINEAR_TOLERANCE: 1e-10,
  /** Denominator zero check for line intersection (1e-10) */
  DENOMINATOR_ZERO: 1e-10,
  /** Duplicate intersection point check (1e-10) */
  INTERSECTION_DUPLICATE: 1e-10,
  /** Circle-circle intersection h value check (1e-10) */
  CIRCLE_INTERSECTION: 1e-10,
  /** Vertex duplicate detection threshold (1e-6) */
  VERTEX_DUPLICATE: 1e-6,
  /** Standard point matching threshold (0.001) */
  POINT_MATCH: 0.001,
  /** Region geometry epsilon (1e-3) */
  REGION_EPSILON: 1e-3,
  /** Entity gap tolerance for matching (1e-3) */
  ENTITY_GAP: 1e-3,
} as const;

/**
 * 🎯 AXIS/GRID DETECTION CONSTANTS
 * Thresholds for detecting zero/axis positions in rulers and grids
 *
 * @example
 * import { AXIS_DETECTION } from '../config/tolerance-config';
 * const isOnAxis = Math.abs(x) < AXIS_DETECTION.ZERO_THRESHOLD;
 */
export const AXIS_DETECTION = {
  /** Zero/axis proximity threshold (0.001) */
  ZERO_THRESHOLD: 0.001,
  /** Grid major line detection (0.001) */
  GRID_MAJOR_THRESHOLD: 0.001,
} as const;

/**
 * 🎯 MOVEMENT DETECTION CONSTANTS
 * Thresholds for detecting meaningful movements and changes
 *
 * @example
 * import { MOVEMENT_DETECTION } from '../config/tolerance-config';
 * if (Math.abs(delta.x) > MOVEMENT_DETECTION.MIN_MOVEMENT) { ... }
 */
export const MOVEMENT_DETECTION = {
  /** Minimum movement to register (0.001) */
  MIN_MOVEMENT: 0.001,
  /** Zoom change detection threshold (0.001) */
  ZOOM_CHANGE: 0.001,
  /** Zoom preset matching threshold (0.01) */
  ZOOM_PRESET_MATCH: 0.01,
} as const;

/**
 * 🎯 VECTOR PRECISION CONSTANTS
 * Thresholds for vector operations and division safety
 *
 * @example
 * import { VECTOR_PRECISION } from '../config/tolerance-config';
 * if (magnitude > VECTOR_PRECISION.MIN_MAGNITUDE) { ... }
 */
export const VECTOR_PRECISION = {
  /** Minimum magnitude for safe division (0.001) */
  MIN_MAGNITUDE: 0.001,
} as const;

/**
 * 🎯 ENTITY LIMITS CONSTANTS
 * Minimum size and tolerance values for entity operations
 *
 * @example
 * import { ENTITY_LIMITS } from '../config/tolerance-config';
 * if (size < ENTITY_LIMITS.MIN_SIZE) return;
 */
export const ENTITY_LIMITS = {
  /** Minimum entity size (0.001) */
  MIN_SIZE: 0.001,
  /** Constraint solving tolerance (0.001) */
  CONSTRAINT_TOLERANCE: 0.001,
} as const;

// ===== SNAP ENGINE CONFIGURATION =====
// 🏢 ADR-087: Centralized Snap Engine Configuration (2026-01-31)

/**
 * 🎯 SNAP SEARCH RADIUS
 * Search radius values για εύρεση reference points σε snap engines
 *
 * @example
 * import { SNAP_SEARCH_RADIUS } from '../config/tolerance-config';
 * const searchRadius = SNAP_SEARCH_RADIUS.REFERENCE_POINT; // 200
 */
export const SNAP_SEARCH_RADIUS = {
  /** Reference point search radius (OrthoSnapEngine) */
  REFERENCE_POINT: 200,
} as const;

/**
 * 🎯 SNAP RADIUS MULTIPLIERS
 * Multipliers για snap radius ανά engine type
 *
 * DOCUMENTATION:
 * - STANDARD (2x): Default για Ortho, Perpendicular, Extension
 * - EXTENDED (3x): Parallel χρειάζεται μεγαλύτερο radius για ανίχνευση παράλληλων γραμμών
 *
 * @example
 * import { SNAP_RADIUS_MULTIPLIERS } from '../config/tolerance-config';
 * const searchRadius = radius * SNAP_RADIUS_MULTIPLIERS.STANDARD; // radius * 2
 */
export const SNAP_RADIUS_MULTIPLIERS = {
  /** Standard multiplier (2x) - Ortho, Perpendicular, Extension */
  STANDARD: 2,
  /** Extended multiplier (3x) - Parallel (needs wider search for parallel line detection) */
  EXTENDED: 3,
} as const;

/**
 * 🎯 SNAP GRID DISTANCES
 * Predefined grid distances για snap engines
 *
 * @example
 * import { SNAP_GRID_DISTANCES } from '../config/tolerance-config';
 * for (const dist of SNAP_GRID_DISTANCES.PARALLEL) { ... }
 */
export const SNAP_GRID_DISTANCES = {
  /** Parallel snap grid distances (ParallelSnapEngine) */
  PARALLEL: [0, 50, 100, 150] as const,
  /** Extension snap distances (ExtensionSnapEngine) */
  EXTENSION: [25, 50, 100, 200, 300] as const,
} as const;

/**
 * 🎯 SNAP GEOMETRY CONSTANTS
 * Mathematical constants για geometric snap calculations
 *
 * @example
 * import { SNAP_GEOMETRY } from '../config/tolerance-config';
 * const diagonalDistance = distance * SNAP_GEOMETRY.INV_SQRT_2;
 */
export const SNAP_GEOMETRY = {
  /** √2 - για diagonal calculations */
  SQRT_2: Math.sqrt(2),
  /** 1/√2 ≈ 0.7071 - για διαίρεση με √2 (πιο γρήγορο από division) */
  INV_SQRT_2: 1 / Math.sqrt(2),
} as const;

// ===== POLYGON CLOSE TOLERANCES =====
// 🏢 ADR-099: Centralized Polygon Tolerances (2026-01-31)

/**
 * 🎯 POLYGON CLOSE TOLERANCES
 * Thresholds for polygon auto-close and edge detection
 *
 * Used for:
 * - Polygon auto-close when clicking near first point (CanvasSection, useDrawingHandlers)
 * - Edge detection for overlay vertex insertion (CanvasSection)
 *
 * @example
 * import { POLYGON_TOLERANCES } from '../config/tolerance-config';
 * if (distance < POLYGON_TOLERANCES.CLOSE_DETECTION / transform.scale) { ... }
 */
export const POLYGON_TOLERANCES = {
  /** Distance threshold for polygon auto-close when clicking near first point (20 world units) */
  CLOSE_DETECTION: 20,
  /** Edge detection tolerance for boundary checks and vertex insertion (15 pixels) */
  EDGE_DETECTION: 15,
} as const;

// ===== MEASUREMENT POSITIONING OFFSETS =====
// 🏢 ADR-099: Centralized Measurement Offsets (2026-01-31)

/**
 * 🎯 MEASUREMENT POSITIONING OFFSETS
 * Offsets for measurement labels and grip positioning
 *
 * Used for:
 * - Smart measurement label positioning (MeasurementPositioning.ts)
 * - Grip point to label distance calculation
 *
 * @example
 * import { MEASUREMENT_OFFSETS } from '../config/tolerance-config';
 * const labelX = gripX + MEASUREMENT_OFFSETS.GRIP;
 */
export const MEASUREMENT_OFFSETS = {
  /** Distance from grip point to measurement label (20 pixels) */
  GRIP: 20,
  /** Top edge offset adjustment for labels near top edge (60 pixels) */
  TOP_EDGE: 60,
} as const;