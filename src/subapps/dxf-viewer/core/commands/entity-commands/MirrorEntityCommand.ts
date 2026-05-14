/**
 * MIRROR ENTITY COMMAND
 *
 * ICommand pattern for mirroring DXF entities across a two-point axis.
 * Supports undo/redo.
 *
 * Two modes:
 *  - keepOriginals = true  (default): creates mirrored copies, originals stay
 *  - keepOriginals = false: replaces originals with mirrored versions
 *
 * @see RotateEntityCommand for the analogous pattern
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { mirrorEntity } from '../../../utils/mirror-math';
import type { MirrorAxis } from '../../../utils/mirror-math';
import type { Entity } from '../../../types/entities';

export class MirrorEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'MirrorEntities';
  readonly type = 'mirror-entities';
  readonly timestamp: number;

  private entitySnapshots: Map<string, SceneEntity> = new Map();
  private createdEntityIds: string[] = [];
  private wasExecuted = false;

  constructor(
    private readonly entityIds: string[],
    private readonly mirrorAxis: MirrorAxis,
    private readonly keepOriginals: boolean = true,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.entitySnapshots.clear();
    this.createdEntityIds = [];

    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;

      const updates = mirrorEntity(entity as unknown as Entity, this.mirrorAxis);

      if (this.keepOriginals) {
        const newId = generateEntityId();
        const newEntity: SceneEntity = { ...entity, ...updates, id: newId };
        this.sceneManager.addEntity(newEntity);
        this.createdEntityIds.push(newId);
      } else {
        this.entitySnapshots.set(entityId, deepClone(entity));
        this.sceneManager.updateEntity(entityId, updates as Partial<SceneEntity>);
      }
    }

    this.wasExecuted = this.keepOriginals
      ? this.createdEntityIds.length > 0
      : this.entitySnapshots.size > 0;
  }

  undo(): void {
    if (!this.wasExecuted) return;

    if (this.keepOriginals) {
      for (const id of this.createdEntityIds) {
        this.sceneManager.removeEntity(id);
      }
    } else {
      for (const [entityId, snapshot] of this.entitySnapshots) {
        const { id: _id, type: _type, layer: _layer, visible: _visible, ...geometry } = snapshot;
        this.sceneManager.updateEntity(entityId, geometry);
      }
    }
  }

  redo(): void {
    if (this.keepOriginals) {
      this.createdEntityIds = [];
      for (const entityId of this.entityIds) {
        const entity = this.sceneManager.getEntity(entityId);
        if (!entity) continue;
        const updates = mirrorEntity(entity as unknown as Entity, this.mirrorAxis);
        const newId = generateEntityId();
        const newEntity: SceneEntity = { ...entity, ...updates, id: newId };
        this.sceneManager.addEntity(newEntity);
        this.createdEntityIds.push(newId);
      }
    } else {
      for (const entityId of this.entityIds) {
        const snapshot = this.entitySnapshots.get(entityId);
        if (snapshot) {
          const updates = mirrorEntity(snapshot as unknown as Entity, this.mirrorAxis);
          this.sceneManager.updateEntity(entityId, updates as Partial<SceneEntity>);
        }
      }
    }
  }

  getDescription(): string {
    const count = this.keepOriginals
      ? this.createdEntityIds.length
      : (this.entitySnapshots.size || this.entityIds.length);
    const mode = this.keepOriginals ? 'copy+mirror' : 'mirror';
    if (count === 1) return `Mirror entity (${mode})`;
    return `Mirror ${count} entities (${mode})`;
  }

  getAffectedEntityIds(): string[] {
    return this.keepOriginals
      ? [...this.createdEntityIds]
      : [...this.entityIds];
  }

  validate(): string | null {
    if (!this.entityIds || this.entityIds.length === 0) {
      return 'At least one entity ID is required';
    }
    const dx = this.mirrorAxis.p2.x - this.mirrorAxis.p1.x;
    const dy = this.mirrorAxis.p2.y - this.mirrorAxis.p1.y;
    if (dx * dx + dy * dy < 1e-10) return 'Mirror axis points must be distinct';
    return null;
  }

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
        mirrorAxis: this.mirrorAxis,
        keepOriginals: this.keepOriginals,
        entitySnapshots: snapshotsArray,
        createdEntityIds: this.createdEntityIds,
      },
      version: 1,
    };
  }
}
