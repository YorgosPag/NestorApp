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
  
  // Snap tolerances (AutoCAD APERTURE default = 10px; reduced for dense drawings)
  SNAP_DEFAULT: 6,          // Default snap tolerance in pixels
  SNAP_PRECISION: 1e-10,    // High-precision snap tolerance (geometric calculations)
  
  // Hit testing (in PIXELS — must be converted to world units via / scale)
  HIT_TEST_DEFAULT: 6,      // Default hit test tolerance (pixels)
  HIT_TEST_FALLBACK: 4,     // 🏢 ADR-105: Fallback tolerance for renderer hitTest methods (pixels)
  HIT_TEST_RADIUS: 8,       // Hit test radius for visual elements (pixels)

  // 🏢 AutoCAD/MicroStation standard: Entity hover/select tolerance in PIXELS
  // AutoCAD PICKBOX default = 3px, MicroStation Locate Tolerance default = 10px
  // Reduced to 3px for dense floor plans (3,000+ entities)
  ENTITY_HOVER_PIXELS: 3,   // How close cursor must be to highlight entity (pixels)
  ENTITY_SELECT_PIXELS: 3,  // How close cursor must be to select entity (pixels)
  
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
  basePixels: 3,
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
  /** Offset change threshold for transform updates (5 pixels) */
  OFFSET_CHANGE: 5,
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
  /** Gap tolerance for entity chain matching (0.5 CAD units) - 🏢 ADR-166 */
  GAP_TOLERANCE: 0.5,
} as const;

// ===== REGION / PERIMETER DETECTION (ADR-363 / ADR-419) =====
// 🏢 Defense-in-depth για το «Δομικά στοιχεία σε περιοχή / από περίγραμμα»
// (κολώνες + τοίχοι). Κοινό SSoT — κατοπτρίζει το PIPE_JOIN_TOLERANCE_MM pattern
// του ADR-408 (mm-based, scene-units-agnostic μέσω mmToSceneUnits στον caller).

/**
 * 🎯 REGION PERIMETER LIMITS
 * Σταθερές για την ανίχνευση κλειστού περιγράμματος κάτω από το cursor όταν ο
 * χρήστης σημαδεύει «περιοχή» για να γεμίσει με κολώνα/τοιχίο/τοίχο.
 *
 * - `LOOP_JOIN_TOLERANCE_MM` (Layer 2 — gap-tolerant closure): μικρά κενά στις
 *   παρειές που σχεδιάστηκαν χωρίς snap κλείνουν αυτόματα (Revit auto-trim/extend).
 *   Χρησιμοποιείται ως floor πάνω από το pixel-based `SNAP_DEFAULT/scale` ώστε να
 *   μην εξαρτάται από το zoom. 50mm = γενναιόδωρο αλλά κάτω από το πάχος τοίχου
 *   (>5cm) ώστε να ΜΗΝ ενώνει διακριτές παρειές.
 * - `MAX_MEMBER_THICKNESS_MM` (Layer 4 — size sanity guard): το μέγιστο «πάχος»
 *   (μικρή πλευρά) ενός υπαρκτού δομικού μέλους. Περίγραμμα με μικρή πλευρά πάνω
 *   από αυτό ΔΕΝ είναι μέλος — είναι το εξωτερικό περίγραμμα του σχεδίου (το bug:
 *   27.78×25.35m). Ελέγχεται ΜΟΝΟ η μικρή πλευρά → legit μακρύς τοίχος (10m × 0.2m)
 *   δεν μπλοκάρεται (false-positive-free). Κολώνες/τοιχία < 3m πάντα περνούν.
 *
 * @example
 * import { REGION_PERIMETER_LIMITS } from '../config/tolerance-config';
 * const tolWorld = Math.max(snapPx / scale, REGION_PERIMETER_LIMITS.LOOP_JOIN_TOLERANCE_MM * mmToScene);
 */
export const REGION_PERIMETER_LIMITS = {
  /** Layer 2 — gap-closure floor σε mm (mirror PIPE_JOIN_TOLERANCE_MM). */
  LOOP_JOIN_TOLERANCE_MM: 50,
  /** Layer 4 — μέγιστο πάχος (μικρή πλευρά) δομικού μέλους σε mm. */
  MAX_MEMBER_THICKNESS_MM: 3000,
} as const;

// ===== JOIN / FORCE-CONNECT TOLERANCES =====
// 🏢 ADR-186: Entity Join System — Force-Connect Tolerances (2026-02-17)

/**
 * 🎯 JOIN FORCE-CONNECT TOLERANCES
 * Progressive tolerance array for entity JOIN operations.
 * Each value is tried in order; first successful connect wins.
 *
 * JOIN is a **deliberate user action** (select + right-click + Join),
 * so we allow much more generous tolerances than automatic chaining.
 *
 * Values are in CAD/world units:
 * - 0.5–2.0: Tight tolerance for precision-drawn entities
 * - 5.0–20.0: Medium tolerance for freehand-drawn entities on canvas
 * - 50.0–100.0: Very generous for entities drawn without snapping
 *
 * @example
 * import { JOIN_TOLERANCES } from '../config/tolerance-config';
 * const chain = chainSegments(segs, entities, JOIN_TOLERANCES.FORCE_CONNECT);
 */
export const JOIN_TOLERANCES = {
  /** Progressive force-connect distances (CAD units) */
  FORCE_CONNECT: [0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0] as const,
  /** Default tolerances for automatic chaining (DXF import, etc.) */
  DEFAULT_CHAIN: [0.2, 0.5, 1.0, 2.0] as const,
} as const;

// ===== ARC TESSELLATION CONFIGURATION =====
// 🏢 ADR-166: Centralized Arc Tessellation Constants (2026-02-01)

/**
 * 🎯 ARC TESSELLATION CONSTANTS
 * Segments για arc-to-polyline conversion
 *
 * Used for:
 * - Arc rendering (tessellation to line segments)
 * - Arc-to-polyline conversion in GeometryUtils
 * - Smooth curve approximation in DXF processing
 *
 * @example
 * import { ARC_TESSELLATION } from '../config/tolerance-config';
 * const segments = ARC_TESSELLATION.DEFAULT_SEGMENTS; // 24
 */
export const ARC_TESSELLATION = {
  /** Default arc segments for tessellation (24 segments = 15° per segment) */
  DEFAULT_SEGMENTS: 24,
} as const;

/**
 * ADR-565 — Adaptive (deviation-driven) circular-arc tessellation for curved
 * structural members (arc walls first, then beams/columns/footings).
 *
 * Unlike {@link ARC_TESSELLATION} (a fixed segment count), the arc-member axis is
 * tessellated at a **chord-deviation tolerance**: the segment angle is chosen so
 * the sagitta between chord and true arc stays under the tolerance, so segment
 * count scales with the arc's radius/sweep (a 10 m-radius wall gets more segments
 * than a 0.4 m one). Mirrors the industry norm (Tekla/ArchiCAD/BricsCAD store the
 * curve parametrically and facet to a deviation tolerance).
 *
 *  - `CHORD_DEVIATION_MM` — commit-time world tolerance (zoom-independent). Feeds
 *    the STORED geometry (BOQ / 3D / snap / hit-test).
 *  - `RENDER_PIXEL_TOL`   — render-time pixel tolerance for the future zoom-adaptive
 *    display axis (Phase 1.x, `worldTol = RENDER_PIXEL_TOL / transform.scale`).
 *  - `MAX_SEGMENTS`       — performance cap (Tekla's 59; ArchiCAD's 36 is the lower
 *    industry anchor).
 *  - `MIN_SEGMENTS`       — smoothness floor for tight/short arcs.
 */
export const ADAPTIVE_ARC_TESSELLATION = {
  /** Commit-time chord-deviation tolerance in mm (world, zoom-independent). */
  CHORD_DEVIATION_MM: 2,
  /** Render-time pixel tolerance for zoom-adaptive display re-tessellation. */
  RENDER_PIXEL_TOL: 0.5,
  /** Performance cap on segments per arc (Tekla). */
  MAX_SEGMENTS: 59,
  /** Smoothness floor on segments per arc. */
  MIN_SEGMENTS: 4,
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
  /** Reference point search radius (OrthoSnapEngine) — in world units */
  REFERENCE_POINT: 100,
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
  /** Standard multiplier (1.5x) - Ortho, Perpendicular, Extension */
  STANDARD: 1.5,
  /** Extended multiplier (2x) - Parallel (needs wider search for parallel line detection) */
  EXTENDED: 2,
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

/**
 * 🎯 SNAP DEFAULTS
 * Default values for snap engine fallbacks
 *
 * @example
 * import { SNAP_DEFAULTS } from '../config/tolerance-config';
 * const radius = context.snapRadius || SNAP_DEFAULTS.FALLBACK_RADIUS;
 */
export const SNAP_DEFAULTS = {
  /** Fallback snap radius when context.snapRadius is undefined (10 pixels) */
  FALLBACK_RADIUS: 10,
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
  /** 🏢 ADR-099: Overlay polygon close detection in pixels (5px - more precise than SNAP_TOLERANCE 10px) */
  OVERLAY_CLOSE_PIXELS: 5,
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

// ===== RULER CONFIGURATION =====
// 🏢 ADR-148: Centralized Ruler Grid Configuration (2026-02-01)

/**
 * 🎯 RULER CONFIGURATION
 * Centralized ruler tick spacing for LayerRenderer
 *
 * Used for:
 * - Ruler label positioning at major tick intervals
 * - Horizontal and vertical ruler rendering
 *
 * @example
 * import { RULER_CONFIG } from '../config/tolerance-config';
 * const step = RULER_CONFIG.MAJOR_TICK_SPACING * transform.scale;
 */
export const RULER_CONFIG = {
  /** Major tick spacing in world units (100) */
  MAJOR_TICK_SPACING: 100,
} as const;

// ===== SNAP ENGINE PRIORITIES =====
// 🏢 ADR-149: Centralized Snap Engine Priority Configuration (2026-02-01)

/**
 * 🎯 SNAP ENGINE PRIORITIES
 * Priority values for snap engines. Lower values = higher priority.
 *
 * Hierarchy:
 * 0 = Highest (Endpoint, Intersection) - Most precise geometric points
 * 1 = Very High (Midpoint, Node) - Important construction points
 * 2 = High (Insertion) - Text/block insertion points
 * 3 = Medium (Center) - Circle/arc centers
 * 4 = Tangent - Tangent points on circles/arcs
 * 5 = Perpendicular - Perpendicular foot on lines/circles
 * 6 = Medium-Low (Parallel) - Parallel line construction
 * 7 = Quadrant - Circle quadrant points (0°, 90°, 180°, 270°)
 * 8 = Low (Extension) - Line extension points
 * 9 = Very Low (Ortho) - Orthogonal constraints
 * 10 = Fallback (Nearest) - Last resort nearest point
 * 11 = Near - General purpose sampling fallback
 * 12 = Grid Major - Major grid intersection points
 * 13 = Grid Minor - Minor grid intersection points
 *
 * @example
 * import { SNAP_ENGINE_PRIORITIES } from '../config/tolerance-config';
 * const priority = SNAP_ENGINE_PRIORITIES.ENDPOINT; // 0
 */
export const SNAP_ENGINE_PRIORITIES = {
  /** Highest priority - exact endpoints of lines/arcs */
  ENDPOINT: 0,
  /** Highest priority - intersection points between entities */
  INTERSECTION: 0,
  /** Very high priority - midpoints of line segments */
  MIDPOINT: 1,
  /** Very high priority - node/vertex points */
  NODE: 1,
  /** High priority - text/block insertion points */
  INSERTION: 2,
  /** Medium priority - circle/arc/rectangle centers */
  CENTER: 3,
  /** Tangent points on circles/arcs */
  TANGENT: 4,
  /** Perpendicular foot on lines/circles */
  PERPENDICULAR: 5,
  /** Parallel line construction */
  PARALLEL: 6,
  /** Circle quadrant points (0°, 90°, 180°, 270°) */
  QUADRANT: 7,
  /** Line extension points */
  EXTENSION: 8,
  /** Orthogonal constraints */
  ORTHO: 9,
  /** Nearest point on entity */
  NEAREST: 10,
  /** General purpose near-sampling fallback */
  NEAR: 11,
  /** Major grid intersection points */
  GRID_MAJOR: 12,
  /** Minor grid intersection points */
  GRID_MINOR: 13,
  /** ADR-189: Construction guide line snap */
  GUIDE: 6,
  /** ADR-189 §3.7-3.16: Construction snap points (X markers) */
  CONSTRUCTION_POINT: 1,
  /** ADR-362 I1: Snap to dimension definition points (AutoCAD DIMSNAP — exact anchor point) */
  DIM_DEF_POINT: 2,
  /** ADR-362 I1: Snap to dimension line reference/midpoint (for baseline/continued chaining) */
  DIM_LINE: 3,
  /** ADR-408 Φ9: MEP connector attach point — above endpoint, below BIM face corners */
  BIM_MEP_CONNECTOR:  -1.5,
  /** ADR-363 Φ1G.5 Slice 2i: BIM wall FACE line — face-to-face magnetism. A *linear* snap, so it
   *  yields to ALL discrete construction points (corners, endpoints, MEP connectors, column centres)
   *  but beats the generic NEAREST/axis projection (10) — you snap to the visible face edge, not the
   *  hidden centreline. Kept low-priority on purpose: zero regression to other tools (the wall-move
   *  flush still works because that path picks by distance across multi-grab probes). */
  BIM_WALL_FACE:      9.5,
  /** ADR-370: generic BIM structural corner snap — highest structural precision */
  BIM_CORNER:         -2,
  /** ADR-370: generic BIM edge/axis midpoint. NEGATIVE (below endpoint 0 / generic MIDPOINT 1)
   *  so a BIM edge midpoint WINS over the coincident raw-DXF line snaps — Revit treats structural
   *  characteristic points as the precise targets. EQUAL to BIM_CENTER on purpose: where both a
   *  face-edge midpoint and the centroid are in range (thin members), the *distance* tiebreak
   *  picks the right one (▲ at the face mid, ⊕ at the centroid) instead of priority hijacking. */
  BIM_MIDPOINT:       -1.7,
  /** ADR-370: generic BIM centroid — same tier as BIM_MIDPOINT (see note above): negative so it
   *  beats generic CENTER (3)/MIDPOINT (1)/ENDPOINT (0), equal to BIM_MIDPOINT so distance decides. */
  BIM_CENTER:         -1.7,
  /** ADR-378 Phase 3: TEXT/MTEXT 8-point snap (insertion + 4 corners + center + 2 edge mids) — same tier as INSERTION */
  TEXT: 2,
  /** ADR-397: rotation centre ⊙ — highest precision while rotating (beats BIM face corners) */
  ROTATION_PIVOT: -2.5,
  /** ADR-397: rotating entity grips — endpoint tier (exact grip points) */
  ROTATION_GRIP: 0,
} as const;

// ===== SNAP UI OFFSETS =====
// 🏢 ADR-153: Centralized Snap Tooltip Offset (2026-02-01)

/**
 * 🎯 SNAP TOOLTIP OFFSET
 * Distance from snap indicator to tooltip label (in pixels)
 *
 * Used for:
 * - Snap indicator tooltip positioning (SnapTypes.ts, LegacySnapAdapter.ts)
 * - Visual feedback consistency across snap rendering systems
 *
 * @example
 * import { SNAP_TOOLTIP_OFFSET } from '../config/tolerance-config';
 * tooltipOffset: SNAP_TOOLTIP_OFFSET, // 15 pixels
 */
export const SNAP_TOOLTIP_OFFSET = 15;

// ===== GEOMETRIC PRECISION UTILITY FUNCTIONS =====
// 🏢 ADR-079: Centralized Precision Check Functions (2026-02-01)

/**
 * 🎯 PRECISION CHECK UTILITIES
 * Semantic functions for geometric precision checks.
 * Replace inline Math.abs(x) < TOLERANCE patterns.
 *
 * @example
 * // ΠΡΙΝ (inline, hard to read):
 * if (Math.abs(denom) < GEOMETRY_PRECISION.DENOMINATOR_ZERO) return null;
 *
 * // ΜΕΤΑ (semantic, clear intent):
 * if (isDenominatorZero(denom)) return null;
 */

/**
 * Check if a value is effectively zero (for division safety)
 * Used for: denominator checks in line intersections
 */
export function isDenominatorZero(value: number): boolean {
  return Math.abs(value) < GEOMETRY_PRECISION.DENOMINATOR_ZERO;
}

/**
 * Check if points are collinear (determinant near zero)
 * Used for: circle from 3 points, line parallelism
 */
export function isCollinear(determinant: number): boolean {
  return Math.abs(determinant) < GEOMETRY_PRECISION.COLLINEAR_TOLERANCE;
}

/**
 * Check if circle intersection height is negligible
 * Used for: circle-circle intersection (single point case)
 */
export function isCircleIntersectionSinglePoint(h: number): boolean {
  return Math.abs(h) < GEOMETRY_PRECISION.CIRCLE_INTERSECTION;
}

/**
 * Generic near-zero check with custom tolerance
 * Used for: any precision check with specific tolerance
 */
export function isNearZero(value: number, tolerance: number): boolean {
  return Math.abs(value) < tolerance;
}

// ===== RENDERING LAYER Z-INDEX =====
// 🏢 ADR-034: Centralized Rendering Z-Index Hierarchy (2026-02-01)

/**
 * 🎯 RENDERING LAYER Z-INDEX
 * Internal canvas rendering priority hierarchy.
 * Lower values = rendered first (background), Higher = rendered last (foreground).
 *
 * ⚠️ ΣΗΜΑΝΤΙΚΟ: Αυτά είναι internal rendering priorities, ΟΧΙ CSS z-index!
 * Για CSS z-index χρησιμοποίησε: styles/DxfZIndexSystem.styles.ts
 *
 * Hierarchy:
 * 0-99:    Background layers (grid)
 * 100-199: Structure layers (rulers)
 * 200-299: Content layers (entities)
 * 300-399: Selection layers (marquee, grips)
 * 800-899: Interactive layers (cursor)
 * 900-949: Feedback layers (snap)
 * 950-999: Overlay layers (crosshair)
 * 1000+:   Debug layers (origin markers)
 *
 * @example
 * import { RENDERING_ZINDEX } from '../config/tolerance-config';
 * zIndex: RENDERING_ZINDEX.GRID // 10
 */
export const RENDERING_ZINDEX = {
  /** Grid - background layer, rendered first */
  GRID: 10,
  /** Rulers - above grid, structure layer */
  RULER: 100,
  /** Entities - main content layer */
  ENTITIES: 200,
  /** Selection marquee and grips */
  SELECTION: 300,
  /** Cursor indicator */
  CURSOR: 800,
  /** Snap indicators - high visibility */
  SNAP: 900,
  /** Crosshair - top interactive layer */
  CROSSHAIR: 950,
  /** Origin markers - debug/reference */
  ORIGIN: 1000,
} as const;

// ===== UI POSITIONING CONSTANTS =====
// 🏢 ADR-167: Centralized UI Positioning Constants (2026-02-01)

/**
 * 🎯 UI POSITIONING CONSTANTS
 * Centralized positioning values for measurement labels, toolbars, and modals
 *
 * Used for:
 * - Measurement label positioning (MeasurementPositioning.ts)
 * - Ruler tick calculations (rulers-grid/utils.ts)
 * - Toolbar positioning (toolbars/utils.ts)
 * - Modal centering (useDraggableModal.ts)
 *
 * @example
 * import { UI_POSITIONING } from '../config/tolerance-config';
 * const y = screenY - UI_POSITIONING.EDGE_MARGIN;
 */
export const UI_POSITIONING = {
  /** Minimum margin from canvas/container edges (15 pixels) */
  EDGE_MARGIN: 15,
  /** Conservative estimate for measurement text width (120 pixels) */
  ESTIMATED_TEXT_WIDTH: 120,
  /** Height per measurement line (20 pixels) */
  MEASUREMENT_LINE_HEIGHT: 20,
  /** Default toolbar margin from edges (20 pixels) */
  TOOLBAR_MARGIN: 20,
  /** Modal top offset from viewport (50 pixels) */
  MODAL_TOP_OFFSET: 50,
  /** Minimum pixel spacing between ruler ticks (15 pixels) */
  MIN_TICK_PIXEL_SPACING: 15,
  /** Target number of major ticks on rulers (8 ticks) */
  DESIRED_TICK_COUNT: 8,
} as const;