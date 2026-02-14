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
  AUTO = 'auto'
}

export interface SnapCandidate {
  point: Point2D;
  type: ExtendedSnapType;
  description: string;
  distance: number;
  priority: number;
  entityId?: string;
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
  enabled: false,
  snapDistance: 12,
  enabledTypes: new Set([
    ExtendedSnapType.AUTO,
    ExtendedSnapType.ENDPOINT,
    ExtendedSnapType.MIDPOINT,
    ExtendedSnapType.CENTER,
    ExtendedSnapType.INTERSECTION,
    ExtendedSnapType.GRID
  ]),
  showSnapMarkers: true,
  showSnapTooltips: true,
  priority: [
    ExtendedSnapType.INTERSECTION,
    ExtendedSnapType.ENDPOINT,
    ExtendedSnapType.MIDPOINT,
    ExtendedSnapType.CENTER,
    ExtendedSnapType.PERPENDICULAR,
    ExtendedSnapType.TANGENT,
    ExtendedSnapType.PARALLEL,
    ExtendedSnapType.QUADRANT,
    ExtendedSnapType.EXTENSION,
    ExtendedSnapType.NODE,
    ExtendedSnapType.INSERTION,
    ExtendedSnapType.NEAREST,
    ExtendedSnapType.NEAR,
    ExtendedSnapType.GRID,
    ExtendedSnapType.AUTO
  ],
  autoMode: true,
  gridStep: 50,
  orthogonalOnly: false,
  tabCycling: true,
  // Βελτιστοποιημένες ανοχές ανά mode (industry best practices)
  perModePxTolerance: {
    [ExtendedSnapType.ENDPOINT]: 10,      // στενή ακτίνα για ακρίβεια
    [ExtendedSnapType.INTERSECTION]: 12,  // standard για intersections
    [ExtendedSnapType.MIDPOINT]: 10,      // στενή για ακρίβεια
    [ExtendedSnapType.CENTER]: 10,        // στενή για κέντρα
    [ExtendedSnapType.PERPENDICULAR]: 14, // ευρύτερη για geometric snaps
    [ExtendedSnapType.TANGENT]: 14,       // ευρύτερη για tangents
    [ExtendedSnapType.GRID]: 12,          // standard για grid
    [ExtendedSnapType.NEAREST]: 10,       // στενή για να μην "αρπάζει" όλα
    [ExtendedSnapType.QUADRANT]: 12,      // standard για quadrants
    [ExtendedSnapType.PARALLEL]: 14       // ευρύτερη για parallel detection
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
