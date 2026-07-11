/**
 * Grip type definitions — extracted from useGripMovement.ts (SRP, ADR-358 Phase 5b).
 * Consumed by useGripMovement, grip-registry, unified-grip-types, stair-grips, dimension-grips.
 *
 * The per-entity parametric grip-kind discriminator unions live in `grip-kinds.ts`
 * (SRP / Google file-size standard N.7.1) and are re-exported here so existing
 * `import { WallGripKind } from '../grip-types'` call-sites keep working unchanged.
 */

import type { Point2D } from '../rendering/types/Types';
import type { GripType, EntityGripKind } from './grip-kinds';

// Re-export the grip-kind unions for backward compatibility (call-sites import
// these from `grip-types`). `export type *` mirrors the import list above without
// re-typing the 33 names — ADR-583 / N.18, no parallel twin list.
export type * from './grip-kinds';

/** Grip information */
export interface GripInfo {
  entityId: string;
  gripIndex: number;
  type: GripType;
  position: Point2D;
  movesEntity: boolean;
  edgeVertexIndices?: [number, number];
  /**
   * ADR-602 (ADR-587 Φ6) Stage 5 — tagged grip discriminator SSoT. The SOLE
   * per-entity grip discriminator: the 31 legacy `xxxGripKind?` optionals were
   * removed (Wave 2). Present only for parametric/gizmo grips; routes the commit
   * through the entity-specific `applyXxxGripDrag()` path. Read via
   * `gripKindOf(grip, '<entity.type>')`.
   */
  gripKind?: EntityGripKind;
  /**
   * ADR-637 Phase 4-A — target rest-landing id for the `stair-rest-landing-*`
   * grips. A stair run can carry several rest landings, so the grip needs to say
   * WHICH landing it edits; the pure transform (`applyStairGripDrag`) patches
   * `restLandings` by matching this id. Absent for every non-rest-landing grip.
   */
  landingId?: string;
}

/** Grip drag state */
export interface GripDragState {
  isDragging: boolean;
  activeGrip: GripInfo | null;
  startPosition: Point2D | null;
  currentPosition: Point2D | null;
  totalDelta: Point2D;
  hasMoved: boolean;
}
