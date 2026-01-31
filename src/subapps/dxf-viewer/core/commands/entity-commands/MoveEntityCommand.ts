/**
 * MOVE ENTITY COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Command for moving entities by delta
 * Supports command merging for smooth drag operations.
 *
 * Pattern: Consecutive moves within 500ms are merged into single command
 * This provides smooth undo for drag operations (Autodesk/Figma pattern)
 *
 * Entity Types Supported:
 * - Line: start += delta, end += delta
 * - Circle: center += delta
 * - Rectangle: corner1 += delta, corner2 += delta
 * - Polyline/Polygon: vertices.forEach(v => v += delta)
 * - Arc: center += delta
 * - Ellipse: center += delta
 * - Text: position += delta
 * - Point: position += delta
 *
 * @see HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';
import { deepClone } from '../../../utils/clone-utils';
// 🏢 ADR-102: Centralized Entity Type Guards
import {
  isLineEntity,
  isCircleEntity,
  isRectangleEntity,
  isArcEntity,
  isEllipseEntity,
  isPolylineEntity,
  isTextEntity,
  isPointEntity,
  type Entity,
} from '../../../types/entities';

/**
 * 🏢 ENTERPRISE: Entity geometry types for type-safe movement
 */
interface LineGeometry {
  start: Point2D;
  end: Point2D;
}

interface CircleGeometry {
  center: Point2D;
  radius: number;
}

interface RectangleGeometry {
  corner1: Point2D;
  corner2: Point2D;
}

interface ArcGeometry {
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
}

interface EllipseGeometry {
  center: Point2D;
  majorAxis: number;
  minorAxis: number;
  rotation?: number;
}

interface PolylineGeometry {
  vertices: Point2D[];
  closed?: boolean;
}

interface TextGeometry {
  position: Point2D;
  text: string;
}

interface PointGeometry {
  position: Point2D;
}

/**
 * 🏢 ENTERPRISE: Union type for all moveable entity geometries
 */
type MoveableGeometry =
  | LineGeometry
  | CircleGeometry
  | RectangleGeometry
  | ArcGeometry
  | EllipseGeometry
  | PolylineGeometry
  | TextGeometry
  | PointGeometry;

// 🏢 ADR-102: Duplicate type guards REMOVED - using centralized guards from types/entities.ts
// Local geometry type assertions for move calculations (entity has already been validated)

/**
 * Apply delta movement to a point
 */
function applyDelta(point: Point2D, delta: Point2D): Point2D {
  return {
    x: point.x + delta.x,
    y: point.y + delta.y,
  };
}

/**
 * Calculate geometry updates for an entity based on delta
 * 🏢 ADR-102: Uses centralized type guards from types/entities.ts
 */
function calculateMovedGeometry(entity: SceneEntity, delta: Point2D): Partial<SceneEntity> {
  // Cast to Entity for type guard compatibility
  // SceneEntity and Entity have same structure, safe to cast via unknown
  const e = entity as unknown as Entity;

  if (isLineEntity(e)) {
    return {
      start: applyDelta(e.start, delta),
      end: applyDelta(e.end, delta),
    };
  }

  if (isCircleEntity(e)) {
    return {
      center: applyDelta(e.center, delta),
    };
  }

  if (isRectangleEntity(e)) {
    // Rectangle may have corner1/corner2 or x/y/width/height
    const updates: Partial<SceneEntity> = {};
    if ('corner1' in e && e.corner1 && 'corner2' in e && e.corner2) {
      updates.corner1 = applyDelta(e.corner1, delta);
      updates.corner2 = applyDelta(e.corner2, delta);
    }
    if ('x' in e && 'y' in e) {
      updates.x = e.x + delta.x;
      updates.y = e.y + delta.y;
    }
    return updates;
  }

  if (isArcEntity(e)) {
    return {
      center: applyDelta(e.center, delta),
    };
  }

  if (isEllipseEntity(e)) {
    return {
      center: applyDelta(e.center, delta),
    };
  }

  if (isPolylineEntity(e)) {
    return {
      vertices: e.vertices.map(v => applyDelta(v, delta)),
    };
  }

  // Handle polygon type (not in centralized guards but used in codebase)
  if (entity.type === 'polygon' && 'vertices' in entity) {
    const polyEntity = entity as unknown as { vertices: Point2D[] };
    return {
      vertices: polyEntity.vertices.map(v => applyDelta(v, delta)),
    };
  }

  if (isTextEntity(e)) {
    return {
      position: applyDelta(e.position, delta),
    };
  }

  if (isPointEntity(e)) {
    return {
      position: applyDelta(e.position, delta),
    };
  }

  // Unknown entity type - return empty updates
  return {};
}

/**
 * Calculate reverse delta
 */
function reverseDelta(delta: Point2D): Point2D {
  return {
    x: -delta.x,
    y: -delta.y,
  };
}

/**
 * Command for moving a single entity by delta
 */
export class MoveEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'MoveEntity';
  readonly type = 'move-entity';
  readonly timestamp: number;

  private entitySnapshot: SceneEntity | null = null;
  private wasExecuted = false;

  constructor(
    private readonly entityId: string,
    private readonly delta: Point2D,
    private readonly sceneManager: ISceneManager,
    /** Optional: Mark as dragging for merge purposes */
    private readonly isDragging: boolean = false
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Move entity by delta
   */
  execute(): void {
    const entity = this.sceneManager.getEntity(this.entityId);
    if (entity) {
      // Store snapshot before move (for undo)
      this.entitySnapshot = deepClone(entity);

      // Calculate new geometry
      const updates = calculateMovedGeometry(entity, this.delta);

      // Apply updates
      this.sceneManager.updateEntity(this.entityId, updates);
      this.wasExecuted = true;
    }
  }

  /**
   * Undo: Move entity by reverse delta
   */
  undo(): void {
    if (this.wasExecuted && this.entitySnapshot) {
      // Restore original geometry from snapshot
      const entity = this.sceneManager.getEntity(this.entityId);
      if (entity) {
        const reversedUpdates = calculateMovedGeometry(entity, reverseDelta(this.delta));
        this.sceneManager.updateEntity(this.entityId, reversedUpdates);
      }
    }
  }

  /**
   * Redo: Move entity by delta again
   */
  redo(): void {
    this.execute();
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    const entityType = this.entitySnapshot?.type ?? 'entity';
    return `Move ${entityType} by (${this.delta.x.toFixed(1)}, ${this.delta.y.toFixed(1)})`;
  }

  /**
   * Check if can merge with another command
   * Merges consecutive moves of the same entity within time window
   */
  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof MoveEntityCommand)) {
      return false;
    }

    // Must be same entity
    if (other.entityId !== this.entityId) {
      return false;
    }

    // Only merge if both are dragging operations
    if (!this.isDragging || !other.isDragging) {
      return false;
    }

    // Check time window
    const timeDiff = other.timestamp - this.timestamp;
    return timeDiff < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  /**
   * Merge with another move command
   * Combines deltas for a single undo operation
   */
  mergeWith(other: ICommand): ICommand {
    const otherMove = other as MoveEntityCommand;
    const combinedDelta: Point2D = {
      x: this.delta.x + otherMove.delta.x,
      y: this.delta.y + otherMove.delta.y,
    };
    return new MoveEntityCommand(
      this.entityId,
      combinedDelta,
      this.sceneManager,
      true // Keep dragging flag
    );
  }

  /**
   * Get the entity ID
   */
  getEntityId(): string {
    return this.entityId;
  }

  /**
   * Get the movement delta
   */
  getDelta(): Point2D {
    return { ...this.delta };
  }

  /**
   * 🏢 ENTERPRISE: Serialize for persistence
   */
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityId: this.entityId,
        delta: this.delta,
        isDragging: this.isDragging,
        entitySnapshot: this.entitySnapshot,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.entityId) {
      return 'Entity ID is required';
    }
    if (this.delta.x === 0 && this.delta.y === 0) {
      return 'Delta must be non-zero';
    }
    return null;
  }
}

/**
 * Command for moving multiple entities at once
 * All entities move by the same delta (batch operation)
 */
export class MoveMultipleEntitiesCommand implements ICommand {
  readonly id: string;
  readonly name = 'MoveMultipleEntities';
  readonly type = 'move-multiple-entities';
  readonly timestamp: number;

  private entitySnapshots: Map<string, SceneEntity> = new Map();
  private wasExecuted = false;

  constructor(
    private readonly entityIds: string[],
    private readonly delta: Point2D,
    private readonly sceneManager: ISceneManager,
    /** Optional: Mark as dragging for merge purposes */
    private readonly isDragging: boolean = false
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Execute: Move all entities by delta
   */
  execute(): void {
    this.entitySnapshots.clear();

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) {
        // Store snapshot before move (for undo)
        this.entitySnapshots.set(entityId, deepClone(entity));

        // Calculate and apply new geometry
        const updates = calculateMovedGeometry(entity, this.delta);
        this.sceneManager.updateEntity(entityId, updates);
      }
    }

    this.wasExecuted = this.entitySnapshots.size > 0;
  }

  /**
   * Undo: Move all entities by reverse delta
   */
  undo(): void {
    if (this.wasExecuted) {
      for (const entityId of this.entityIds) {
        const entity = this.sceneManager.getEntity(entityId);
        if (entity) {
          const reversedUpdates = calculateMovedGeometry(entity, reverseDelta(this.delta));
          this.sceneManager.updateEntity(entityId, reversedUpdates);
        }
      }
    }
  }

  /**
   * Redo: Move all entities by delta again
   */
  redo(): void {
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) {
        const updates = calculateMovedGeometry(entity, this.delta);
        this.sceneManager.updateEntity(entityId, updates);
      }
    }
  }

  /**
   * Get description for UI
   */
  getDescription(): string {
    return `Move ${this.entitySnapshots.size} entities by (${this.delta.x.toFixed(1)}, ${this.delta.y.toFixed(1)})`;
  }

  /**
   * Check if can merge with another command
   * Merges consecutive moves of the same entities within time window
   */
  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof MoveMultipleEntitiesCommand)) {
      return false;
    }

    // Must be same set of entities
    if (other.entityIds.length !== this.entityIds.length) {
      return false;
    }

    const thisSet = new Set(this.entityIds);
    const otherSet = new Set(other.entityIds);

    for (const id of thisSet) {
      if (!otherSet.has(id)) {
        return false;
      }
    }

    // Only merge if both are dragging operations
    if (!this.isDragging || !other.isDragging) {
      return false;
    }

    // Check time window
    const timeDiff = other.timestamp - this.timestamp;
    return timeDiff < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  /**
   * Merge with another move command
   * Combines deltas for a single undo operation
   */
  mergeWith(other: ICommand): ICommand {
    const otherMove = other as MoveMultipleEntitiesCommand;
    const combinedDelta: Point2D = {
      x: this.delta.x + otherMove.delta.x,
      y: this.delta.y + otherMove.delta.y,
    };
    return new MoveMultipleEntitiesCommand(
      this.entityIds,
      combinedDelta,
      this.sceneManager,
      true // Keep dragging flag
    );
  }

  /**
   * Get the entity IDs
   */
  getEntityIds(): string[] {
    return [...this.entityIds];
  }

  /**
   * Get the movement delta
   */
  getDelta(): Point2D {
    return { ...this.delta };
  }

  /**
   * 🏢 ENTERPRISE: Serialize for persistence
   */
  serialize(): SerializedCommand {
    const snapshotsArray: Array<{ id: string; entity: SceneEntity }> = [];
    this.entitySnapshots.forEach((entity, id) => {
      snapshotsArray.push({ id, entity });
    });

    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityIds: this.entityIds,
        delta: this.delta,
        isDragging: this.isDragging,
        entitySnapshots: snapshotsArray,
      },
      version: 1,
    };
  }

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    return [...this.entityIds];
  }

  /**
   * Validate command can be executed
   */
  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) {
      return 'At least one entity ID is required';
    }
    if (this.delta.x === 0 && this.delta.y === 0) {
      return 'Delta must be non-zero';
    }
    return null;
  }
}
