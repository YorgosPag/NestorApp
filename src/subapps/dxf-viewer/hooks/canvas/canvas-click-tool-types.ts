/**
 * 🏢 ENTERPRISE: Canvas Click Handler — Supporting & Tool Types
 *
 * @description Entity-pick payload types and the minimal "*ToolLike" interfaces
 * consumed by the useCanvasClickHandler params. Extracted from canvas-click-types.ts
 * to keep each module under the Google SRP line budget (ADR N.7.1).
 *
 * Re-exported by canvas-click-types.ts so existing import sites are unchanged.
 *
 * @see ADR-030: Universal Selection System
 * @see ADR-046: World Coordinate Click Pattern
 * @see ADR-189: Construction Guide System
 */

import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, SceneModel } from '../../types/entities';

// ============================================================================
// ENTITY TYPES
// ============================================================================

/** ADR-189 §3.9/3.10: Arc or circle entity for entity-picking callbacks */
export interface ArcPickableEntity {
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  isFullCircle: boolean;
}

/** ADR-189 §3.12: Line entity for entity-picking callbacks */
export interface LinePickableEntity {
  start: Point2D;
  end: Point2D;
}

// ============================================================================
// MINIMAL INTERFACES FOR DEPENDENCIES
// ============================================================================

/** Minimal interface for drawing handlers ref */
export interface DrawingHandlersLike {
  onDrawingPoint?: (point: Point2D) => void;
  drawingState?: { tempPoints?: Array<unknown> };
}

/** Minimal interface for special tool hooks */
export interface SpecialToolLike {
  isWaitingForSelection?: boolean;
  isActive?: boolean;
  currentStep?: number;
  onEntityClick: (entity: AnySceneEntity, point: Point2D) => boolean;
  onCanvasClick?: (point: Point2D) => void;
}

/** Minimal interface for angle entity measurement tool */
export interface AngleEntityToolLike {
  isActive: boolean;
  isWaitingForEntitySelection: boolean;
  currentStep: 0 | 1;
  onEntityClick: (entity: AnySceneEntity, point: Point2D) => boolean;
  acceptsEntityType: (entityType: string) => boolean;
}

/** Minimal interface for DXF grip interaction */
export interface DxfGripInteractionLike {
  handleGripClick: (worldPoint: Point2D) => boolean;
}

/** ADR-358 Phase 5a — Minimal stair tool interface for click routing. */
export interface StairToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-363 Phase 1B — Minimal wall tool interface for click routing. */
export interface WallToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
  /** ADR-363 Phase 1J — true while the on-entity tool awaits the source pick (click 1). */
  readonly isAwaitingStart?: boolean;
  /** ADR-363 Phase 1K — entity ids of accumulated in-region line picks (highlight). */
  getRegionPickIds?: () => string[];
}

/** ADR-363 Phase 3 — Minimal slab tool interface for click routing. */
export interface SlabToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-363 Phase 4 — Minimal column tool interface for click routing. */
export interface ColumnToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-363 Phase 5 — Minimal beam tool interface for click routing. */
export interface BeamToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-406 — Minimal MEP fixture tool interface for click routing. */
export interface MepFixtureToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-408 Φ8 — Minimal MEP segment (duct/pipe) tool interface for click routing. */
export interface MepSegmentToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-408 Φ3 — Minimal electrical panel tool interface for click routing. */
export interface ElectricalPanelToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-408 Φ12 — Minimal plumbing manifold tool interface for click routing. */
export interface MepManifoldToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-408 Εύρος Β — Minimal heating radiator tool interface for click routing. */
export interface MepRadiatorToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-410 — Minimal furniture tool interface for click routing. */
export interface FurnitureToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-415 — Minimal floorplan-symbol tool interface for click routing. */
export interface FloorplanSymbolToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-407 — Minimal railing tool interface for click routing (2-click line). */
export interface RailingToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-363 Phase 3.7 — Minimal slab-opening tool interface for click routing. */
export interface SlabOpeningToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** ADR-363 Phase 2 — Minimal opening tool interface for click routing. */
export interface OpeningToolLike {
  readonly isActive: boolean;
  onCanvasClick: (point: Point2D) => boolean;
}

/** Minimal interface for level manager (read-only for click handling) */
export interface LevelManagerLike {
  currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
}
