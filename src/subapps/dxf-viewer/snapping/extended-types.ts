/**
 * Extended Types για Pro Snap Engine
 * Εκτεταμένοι τύποι για το προχωρημένο σύστημα snapping
 *
 * 🏢 ENTERPRISE CENTRALIZATION (2025-01-05):
 * - Entity type: Re-exported from centralized types/entities.ts
 * - Point2D: Re-exported from rendering/types/Types.ts
 * - All snap-specific types defined here (SnapCandidate, ProSnapResult, etc.)
 */

// ✅ ENTERPRISE: Χρήση unified Point2D από rendering/types/Types.ts
import type { Point2D } from '../rendering/types/Types';
export type { Point2D } from '../rendering/types/Types';

// 🏢 ENTERPRISE CENTRALIZATION: Entity από κεντρικοποιημένο σύστημα
// Αντικαθιστά το παλιό loose interface με strict discriminated union
import type { Entity } from '../types/entities';
export type { Entity };

// Direct definition αντί για re-export για να αποφύγουμε circular import
export enum ExtendedSnapType {
  // Βασικά modes
  ENDPOINT = 'endpoint',
  MIDPOINT = 'midpoint',
  CENTER = 'center',
  INTERSECTION = 'intersection',
  PERPENDICULAR = 'perpendicular',
  TANGENT = 'tangent',
  QUADRANT = 'quadrant',
  NEAREST = 'nearest',

  // Προχωρημένα modes
  EXTENSION = 'extension',
  NODE = 'node',
  INSERTION = 'insertion',
  NEAR = 'near',
  PARALLEL = 'parallel',
  ORTHO = 'ortho',
  GRID = 'grid',
  GUIDE = 'guide',  // ADR-189: Construction guide snap
  CONSTRUCTION_POINT = 'construction_point',  // ADR-189 §3.7-3.16: Construction snap points
  DIM_DEF_POINT = 'dim_def_point',  // ADR-362 I1: snap to dimension def points (AutoCAD DIMSNAP)
  DIM_LINE = 'dim_line',            // ADR-362 I1: snap to dimension line for baseline/continued chains
  // ADR-370: ONE generic BIM structural corner snap (wall/beam/slab/column/opening +
  // foundation/centred-box…). Replaces the 5 per-entity BIM_*_CORNER types — the
  // per-entity label («Γωνία τοίχου»/«δοκαριού») comes from the candidate `description`.
  BIM_CORNER         = 'bim_corner',
  BIM_MIDPOINT       = 'bim_midpoint',        // ADR-370: generic BIM edge/axis midpoint («Μέσο τοίχου»…)
  BIM_CENTER         = 'bim_center',          // ADR-370: generic BIM centroid («Κέντρο πλάκας»…)
  BIM_WALL_FACE      = 'bim_wall_face',       // ADR-363 Φ1G.5 Slice 2i: wall outer/inner FACE line (face-to-face magnetism)
  BIM_MEP_CONNECTOR  = 'bim_mep_connector',  // ADR-408 Φ9: MEP connector attach point (segment endpoints / fixture / panel)
  TEXT               = 'text',                // ADR-378 Phase 3: TEXT/MTEXT 8-point snap (insertion + 4 corners + center + 2 edge mids)
  ROTATION_PIVOT     = 'rotation_pivot',      // ADR-397: rotation centre ⊙ snap (active only during a rotation op)
  ROTATION_GRIP      = 'rotation_grip',       // ADR-397: rotating entity's grips snap (active only during a rotation op)
  AUTO = 'auto'
}

export interface SnapCandidate {
  point: Point2D;
  type: ExtendedSnapType;
  description: string;
  distance: number;
  priority: number;
  entityId?: string;
  /**
   * ADR-363 Φ1G.5 Slice 2i — the linear reference the snap projected onto (a wall
   * face line, a wall axis, a grid line). Present ONLY for *linear* snaps (faces /
   * axes / grids); discrete point snaps (endpoint / corner / midpoint) leave it
   * undefined. Surfaced up through `ProSnapResult.snapPoint` so the 3D gizmo can
   * draw a Revit dashed alignment line along it. Additive / back-compat.
   */
  referenceSegment?: { start: Point2D; end: Point2D };
}

export interface ProSnapResult {
  found: boolean;
  snapPoint: SnapCandidate | null;
  allCandidates: SnapCandidate[];
  originalPoint: Point2D;
  snappedPoint: Point2D;
  activeMode: ExtendedSnapType | null;
  timestamp: number;
  // ✅ ENTERPRISE FIX: Added convenience properties για direct coordinate access
  x?: number; // Convenience getter για snappedPoint.x
  y?: number; // Convenience getter για snappedPoint.y
  entityId?: string; // Entity ID που snap operation target
  distance?: number; // Distance to snap point
}

/**
 * 🏢 ENTERPRISE CENTRALIZATION (2025-01-05):
 * SnapResult is an alias for ProSnapResult - SINGLE SOURCE OF TRUTH
 * Use snappedPoint (not point) for coordinates
 */
export type SnapResult = ProSnapResult;

/**
 * 🏢 SSoT presentation view-model for the snap indicator overlay (ADR-137 §Step 2).
 *
 * `SnapIndicatorOverlay` needs only these three fields. Field names intentionally
 * differ from `ProSnapResult` (`point` ← `snappedPoint`, `type` ← `activeMode`,
 * `description` ← `snapPoint.description`). This is the ONE place that projection
 * lives — do NOT re-declare an inline `{ point; type; description? }` anywhere else.
 * Replaces the former parallel `SnapResult` definitions in `layer-types.ts`,
 * `rendering/ui/snap/SnapTypes.ts`, `layer-canvas-hooks.ts`, and the inline interface
 * in `SnapIndicatorOverlay.tsx`.
 */
export interface SnapIndicatorView {
  point: Point2D;
  type: string;
  description?: string;
}

/**
 * Single adapter projecting the canonical `ProSnapResult` onto the overlay view-model.
 * Returns `null` for a null result (no active snap).
 */
export function toSnapIndicatorView(result: ProSnapResult | null): SnapIndicatorView | null {
  if (!result) return null;
  return {
    point: result.snappedPoint,
    type: result.activeMode || 'endpoint',
    description: result.snapPoint?.description,
  };
}

/**
 * 🏢 SSoT — «πότε φωτίζεται μια έλξη» (πότε το `SnapIndicatorOverlay` ζωγραφίζει marker).
 *
 * AutoCAD σύμβαση: grid & guide-line snaps είναι ΣΙΩΠΗΛΑ — ο κέρσορας κουμπώνει χωρίς
 * ορατό marker (το grid δεν έχει σύμβολο· η οδηγός-γραμμή δείχνει ήδη πού κλείδωσε).
 * Κάθε άλλη ενεργή έλξη ζωγραφίζει marker.
 *
 * Type predicate → narrow σε `SnapIndicatorView`. Καταναλώνεται από:
 *   - `SnapIndicatorOverlay` (αν false → return null, δεν ζωγραφίζει marker)
 *   - `CrosshairOverlay` (αν true → κρύβει το pickbox του σταυρονήματος — το marker «κουμπώνει»
 *     το κέντρο, οπότε το τετράγωνο περισσεύει)
 */
/**
 * 🏢 SSoT primitive — «είναι ΟΡΑΤΗ/σκληρή έλξη αυτό το mode;» πάνω στο raw string.
 * grid & guide = ΣΙΩΠΗΛΑ (AutoCAD σύμβαση) → false· κάθε άλλο ενεργό mode → true. ΕΝΑ κριτήριο,
 * καταναλώνεται όπου κρίνεται «τι βλέπει/κλείδωσε ρητά ο χρήστης», ανεξάρτητα από το shape του snap
 * (`SnapIndicatorView.type` / `ProSnapResult.activeMode` / `ImmediateSnapResult.mode`). Έτσι π.χ.
 * το «η fux φαίνεται» και το «η κορυφή παρακάμπτει το line-flush» ΔΕΝ μπορούν να αποκλίνουν.
 */
export function isVisibleSnapMode(mode: string | null | undefined): boolean {
  return !!mode && mode !== 'grid' && mode !== 'guide';
}

export function isSnapMarkerVisible(view: SnapIndicatorView | null | undefined): view is SnapIndicatorView {
  if (!view || !view.point) return false;
  return isVisibleSnapMode(view.type);
}

// Per-mode tolerances σε pixels
export type PerModeTolerance = Partial<Record<ExtendedSnapType, number>>;

export interface SnapConfig {
  snapType: ExtendedSnapType;
  displayName: string;
  priority?: number;
  tolerance?: number;
}

export interface ProSnapSettings {
  enabled: boolean;
  snapDistance: number;
  enabledTypes: Set<ExtendedSnapType>;
  showSnapMarkers: boolean;
  showSnapTooltips: boolean;
  priority: ExtendedSnapType[];
  autoMode: boolean;
  gridStep: number;
  orthogonalOnly: boolean;
  tabCycling: boolean;
  perModePxTolerance?: PerModeTolerance; // διαφορετικές ανοχές ανά mode
}

// Default settings για Pro Snap Engine
export const DEFAULT_PRO_SNAP_SETTINGS: ProSnapSettings = {
  enabled: true,  // 🏢 FIX (2026-02-21): Default to true — SnapContext.snapEnabled is the real gate
  snapDistance: 10,
  enabledTypes: new Set([
    ExtendedSnapType.AUTO,
    ExtendedSnapType.ENDPOINT,
    ExtendedSnapType.MIDPOINT,
    ExtendedSnapType.CENTER,
    ExtendedSnapType.INTERSECTION,
    ExtendedSnapType.GRID,
    ExtendedSnapType.GUIDE,             // ADR-189: Guide snap enabled by default
    ExtendedSnapType.CONSTRUCTION_POINT, // ADR-189: Construction point snap
    ExtendedSnapType.DIM_DEF_POINT,     // ADR-362 I1: dimension def point snap
    ExtendedSnapType.DIM_LINE,          // ADR-362 I1: dimension line snap
    ExtendedSnapType.BIM_CORNER,          // ADR-370: generic BIM structural corner (all entities)
    ExtendedSnapType.BIM_MIDPOINT,        // ADR-370: generic BIM edge/axis midpoint (all entities)
    ExtendedSnapType.BIM_CENTER,          // ADR-370: generic BIM centroid (area entities)
    ExtendedSnapType.BIM_WALL_FACE,       // ADR-363 Φ1G.5 Slice 2i: wall face line (face magnetism)
    ExtendedSnapType.BIM_MEP_CONNECTOR,   // ADR-408 Φ9: MEP connector attach point
    ExtendedSnapType.TEXT,                // ADR-378 Phase 3: TEXT/MTEXT 8-point snap
    ExtendedSnapType.ROTATION_PIVOT,      // ADR-397: rotation centre snap (contextual — store empty when idle)
    ExtendedSnapType.ROTATION_GRIP,       // ADR-397: rotating entity grips snap (contextual)
  ]),
  showSnapMarkers: true,
  showSnapTooltips: true,
  priority: [
    ExtendedSnapType.ROTATION_PIVOT,      // ADR-397: rotation centre — highest precision while rotating
    // ADR-370: the 3 always-on BIM structural characteristic snaps run FIRST (right after the
    // rotation pivot), BEFORE the generic discrete engines (INTERSECTION/ENDPOINT/MIDPOINT/NEAREST).
    // This array is the orchestrator's *iteration* order and is bounded by maxCandidates (8): a
    // dense DXF's raw endpoints/intersections would otherwise fill the budget and STARVE these
    // engines (the «Μέσο/Κέντρο never appear» bug). Their negative priority numbers still let the
    // SnapCandidateProcessor pick the correct winner when points coincide.
    ExtendedSnapType.BIM_CORNER,          // ADR-370: BIM structural corners — highest structural precision
    ExtendedSnapType.BIM_MIDPOINT,        // ADR-370: BIM edge/axis midpoint — structural, before generic snaps
    ExtendedSnapType.BIM_CENTER,          // ADR-370: BIM centroid — structural, before generic snaps
    ExtendedSnapType.BIM_MEP_CONNECTOR,   // ADR-408 Φ9: MEP attach point — before endpoint
    ExtendedSnapType.INTERSECTION,
    ExtendedSnapType.ENDPOINT,
    ExtendedSnapType.ROTATION_GRIP,       // ADR-397: rotating entity grips — endpoint tier
    ExtendedSnapType.MIDPOINT,
    ExtendedSnapType.INSERTION,           // ADR-378 §5: priority 2 — before TEXT (also 2)
    ExtendedSnapType.TEXT,                // ADR-378 Phase 3: text 8-point snap — priority 2 (after INSERTION)
    ExtendedSnapType.CENTER,
    ExtendedSnapType.PERPENDICULAR,
    ExtendedSnapType.TANGENT,
    ExtendedSnapType.PARALLEL,
    ExtendedSnapType.QUADRANT,
    ExtendedSnapType.EXTENSION,
    ExtendedSnapType.NODE,
    ExtendedSnapType.BIM_WALL_FACE,       // ADR-363 Φ1G.5 Slice 2i: linear face snap — runs after discrete points, before NEAREST
    ExtendedSnapType.NEAREST,
    ExtendedSnapType.NEAR,
    ExtendedSnapType.GUIDE,              // ADR-189: Construction guide snap
    ExtendedSnapType.CONSTRUCTION_POINT, // ADR-189: Construction snap points
    ExtendedSnapType.DIM_DEF_POINT,     // ADR-362 I1: dimension def point snap (high priority — exact point)
    ExtendedSnapType.DIM_LINE,          // ADR-362 I1: dimension line snap
    ExtendedSnapType.GRID,
    ExtendedSnapType.AUTO
  ],
  autoMode: true,
  gridStep: 50,
  orthogonalOnly: false,
  tabCycling: true,
  // AutoCAD APERTURE default = 10px — matched across all types
  perModePxTolerance: {
    [ExtendedSnapType.ENDPOINT]: 10,
    [ExtendedSnapType.INTERSECTION]: 10,
    [ExtendedSnapType.MIDPOINT]: 10,
    [ExtendedSnapType.CENTER]: 10,
    [ExtendedSnapType.PERPENDICULAR]: 10,
    [ExtendedSnapType.TANGENT]: 10,
    [ExtendedSnapType.GRID]: 10,
    [ExtendedSnapType.NEAREST]: 10,
    [ExtendedSnapType.QUADRANT]: 10,
    [ExtendedSnapType.PARALLEL]: 10,
    [ExtendedSnapType.GUIDE]: 12,               // ADR-189: intentionally wider for easy grab
    [ExtendedSnapType.CONSTRUCTION_POINT]: 10,
    [ExtendedSnapType.DIM_DEF_POINT]: 10,      // ADR-362 I1: exact definition point — AutoCAD APERTURE default
    [ExtendedSnapType.DIM_LINE]: 10,            // ADR-362 I1: dim line reference point
    [ExtendedSnapType.BIM_CORNER]:          10, // ADR-370: generic BIM structural corner
    [ExtendedSnapType.BIM_MIDPOINT]:        10, // ADR-370: generic BIM edge/axis midpoint
    [ExtendedSnapType.BIM_CENTER]:          10, // ADR-370: generic BIM centroid
    [ExtendedSnapType.BIM_WALL_FACE]:       30, // ADR-363 Φ1G.5 Slice 2i/2j: wall face line (2j: strong diagnostic pull, Giorgio)
    [ExtendedSnapType.BIM_MEP_CONNECTOR]:   10, // ADR-408 Φ9: MEP connector attach point
    [ExtendedSnapType.TEXT]:                10, // ADR-378 Phase 3: text 8-point snap (insertion/corners/center/edges)
    [ExtendedSnapType.ROTATION_PIVOT]:      12, // ADR-397: rotation centre — wide grab (easy magnetism to ⊙)
    [ExtendedSnapType.ROTATION_GRIP]:       10, // ADR-397: rotating entity grips — AutoCAD APERTURE default
  }
};

export interface SnapEngineStats {
  totalSnapAttempts: number;
  successfulSnaps: number;
  snapsByType: Record<ExtendedSnapType, number>;
  averageSearchTime: number;
  totalEntitiesProcessed: number;
  cacheHitRate?: number;
  lastResetTime: number;

  // ✅ ENTERPRISE FIX: Alias for backward compatibility with SnapDebugLogger
  totalEntities?: number; // Alias for totalEntitiesProcessed
}

export interface SnapEngineInterface {
  initialize(entities: Entity[]): void;
  updateSettings(settings: Partial<ProSnapSettings>): void;
  findSnapPoint(cursorPoint: Point2D, excludeEntityId?: string): ProSnapResult;
  setEnabled(enabled: boolean): void;
  toggleSnapType(snapType: ExtendedSnapType, enabled: boolean): void;
  cycleCandidates(): void;
  getStats(): SnapEngineStats;
  dispose(): void;
}
