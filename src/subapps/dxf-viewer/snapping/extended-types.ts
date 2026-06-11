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
  BIM_COLUMN_CENTER  = 'bim_column_center',   // ADR-363 Phase 5.5i: structural column center-axis snap
  BIM_WALL_CORNER    = 'bim_wall_corner',    // ADR-370: wall face corner (outer/inner edge)
  BIM_WALL_FACE      = 'bim_wall_face',       // ADR-363 Φ1G.5 Slice 2i: wall outer/inner FACE line (face-to-face magnetism)
  BIM_BEAM_CORNER    = 'bim_beam_corner',    // ADR-370: beam outline corner
  BIM_SLAB_CORNER    = 'bim_slab_corner',    // ADR-370: slab polygon vertex
  BIM_COLUMN_CORNER  = 'bim_column_corner',  // ADR-370: column perimeter corner
  BIM_OPENING_CORNER = 'bim_opening_corner', // ADR-370: opening (door/window) face corner
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
    ExtendedSnapType.BIM_COLUMN_CENTER,   // ADR-363 Phase 5.5i: column center axis snap
    ExtendedSnapType.BIM_WALL_CORNER,     // ADR-370: wall face corner
    ExtendedSnapType.BIM_WALL_FACE,       // ADR-363 Φ1G.5 Slice 2i: wall face line (face magnetism)
    ExtendedSnapType.BIM_BEAM_CORNER,     // ADR-370: beam outline corner
    ExtendedSnapType.BIM_SLAB_CORNER,     // ADR-370: slab polygon vertex
    ExtendedSnapType.BIM_COLUMN_CORNER,   // ADR-370: column perimeter corner
    ExtendedSnapType.BIM_OPENING_CORNER,  // ADR-370: opening face corner
    ExtendedSnapType.BIM_MEP_CONNECTOR,   // ADR-408 Φ9: MEP connector attach point
    ExtendedSnapType.TEXT,                // ADR-378 Phase 3: TEXT/MTEXT 8-point snap
    ExtendedSnapType.ROTATION_PIVOT,      // ADR-397: rotation centre snap (contextual — store empty when idle)
    ExtendedSnapType.ROTATION_GRIP,       // ADR-397: rotating entity grips snap (contextual)
  ]),
  showSnapMarkers: true,
  showSnapTooltips: true,
  priority: [
    ExtendedSnapType.ROTATION_PIVOT,      // ADR-397: rotation centre — highest precision while rotating
    ExtendedSnapType.BIM_WALL_CORNER,     // ADR-370: face corners — highest structural precision
    ExtendedSnapType.BIM_BEAM_CORNER,     // ADR-370
    ExtendedSnapType.BIM_SLAB_CORNER,     // ADR-370
    ExtendedSnapType.BIM_COLUMN_CORNER,   // ADR-370
    ExtendedSnapType.BIM_OPENING_CORNER,  // ADR-370
    ExtendedSnapType.BIM_MEP_CONNECTOR,   // ADR-408 Φ9: MEP attach point — before column centre & endpoint
    ExtendedSnapType.BIM_COLUMN_CENTER,   // ADR-363 Phase 5.5i: structural precision — before generic endpoint
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
    [ExtendedSnapType.BIM_COLUMN_CENTER]:   10, // ADR-363 Phase 5.5i: column center axis snap
    [ExtendedSnapType.BIM_WALL_CORNER]:     10, // ADR-370
    [ExtendedSnapType.BIM_WALL_FACE]:       30, // ADR-363 Φ1G.5 Slice 2i/2j: wall face line (2j: strong diagnostic pull, Giorgio)
    [ExtendedSnapType.BIM_BEAM_CORNER]:     10, // ADR-370
    [ExtendedSnapType.BIM_SLAB_CORNER]:     10, // ADR-370
    [ExtendedSnapType.BIM_COLUMN_CORNER]:   10, // ADR-370
    [ExtendedSnapType.BIM_OPENING_CORNER]:  10, // ADR-370
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
