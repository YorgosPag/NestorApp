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
// 🏢 ADR-065: Extracted geometry utilities
import { calculateMovedGeometry, reverseDelta } from './move-entity-geometry';
// SSoT for the move cascade ordering (pipes → updates → wall-openings → slab-openings →
// reframe-beams + emit). Both move commands delegate here so they stay in sync.
// ADR-049 / ADR-363 / ADR-408 Φ-C / ADR-492 — rationale lives in the module header.
import { runMoveForwardCascade, runMoveUndoCascade } from './move-entity-cascade';

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
      this.wasExecuted = true;
      // Post-move host built from snapshot+updates (no getLevelScene — stale at
      // synchronous emit time). Persistence symmetry with the multi-entity command:
      // without the cascade emit a single-entity 3D gizmo move never persisted.
      const movedEntity = { ...this.entitySnapshot, ...updates } as SceneEntity;
      runMoveForwardCascade(
        [this.entityId], this.delta, this.sceneManager, [movedEntity],
        () => this.sceneManager.updateEntity(this.entityId, updates),
      );
    }
  }

  /**
   * Undo: Move entity by reverse delta
   */
  undo(): void {
    if (this.wasExecuted && this.entitySnapshot) {
      const entity = this.sceneManager.getEntity(this.entityId);
      if (entity) {
        const reversedUpdates = calculateMovedGeometry(entity, reverseDelta(this.delta));
        const revertedEntity = { ...this.entitySnapshot } as SceneEntity;
        runMoveUndoCascade(
          [this.entityId], this.delta, this.sceneManager, [revertedEntity],
          () => this.sceneManager.updateEntity(this.entityId, reversedUpdates),
        );
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
   * Execute: Move all entities by delta — single batch commit, O(n_scene) not N×O(n_scene).
   */
  execute(): void {
    this.entitySnapshots.clear();
    const updatesMap = new Map<string, Partial<SceneEntity>>();

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) {
        this.entitySnapshots.set(entityId, deepClone(entity));
        updatesMap.set(entityId, calculateMovedGeometry(entity, this.delta));
      }
    }

    if (updatesMap.size > 0) {
      this.wasExecuted = true;
      // Build post-move entities from snapshots+updates (safe: no getLevelScene call,
      // which would return stale React state at synchronous emit time).
      const movedEntities: SceneEntity[] = [];
      for (const [entityId, updates] of updatesMap) {
        const snapshot = this.entitySnapshots.get(entityId);
        if (snapshot) movedEntities.push({ ...snapshot, ...updates } as SceneEntity);
      }
      runMoveForwardCascade(
        this.entityIds, this.delta, this.sceneManager, movedEntities,
        () => this.sceneManager.updateEntities(updatesMap),
      );
    }
  }

  /**
   * Undo: Move all entities by reverse delta — single batch commit.
   */
  undo(): void {
    if (!this.wasExecuted) return;
    const updatesMap = new Map<string, Partial<SceneEntity>>();

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) {
        updatesMap.set(entityId, calculateMovedGeometry(entity, reverseDelta(this.delta)));
      }
    }

    if (updatesMap.size > 0) {
      // Build reverted entities from snapshots before touching the scene so the
      // cascade can emit them first. Snapshots carry the original (pre-move) params —
      // correct for Firestore persistence regardless of scene state at emit time.
      const revertedEntities: SceneEntity[] = [];
      for (const entityId of this.entityIds) {
        const snapshot = this.entitySnapshots.get(entityId);
        if (snapshot) revertedEntities.push(snapshot);
      }
      runMoveUndoCascade(
        this.entityIds, this.delta, this.sceneManager, revertedEntities,
        () => this.sceneManager.updateEntities(updatesMap),
      );
    }
  }

  /**
   * Redo: Move all entities by delta again — single batch commit.
   */
  redo(): void {
    const updatesMap = new Map<string, Partial<SceneEntity>>();
    const movedEntities: SceneEntity[] = [];

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) {
        const updates = calculateMovedGeometry(entity, this.delta);
        updatesMap.set(entityId, updates);
        movedEntities.push({ ...entity, ...updates } as SceneEntity);
      }
    }

    if (updatesMap.size > 0) {
      runMoveForwardCascade(
        this.entityIds, this.delta, this.sceneManager, movedEntities,
        () => this.sceneManager.updateEntities(updatesMap),
      );
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
