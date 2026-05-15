/**
 * STRETCH ENTITY COMMAND — ADR-349
 *
 * Undoable command applying a displacement vector to:
 *   - per-vertex captures (LINE / POLYLINE / SPLINE / ARC endpoints)
 *   - whole-entity anchor captures (CIRCLE / ELLIPSE / TEXT / INSERT / POINT)
 *
 * Single undo step reverses the entire stretch (Q11: 1 audit entry / command
 * via IDxfTextAuditRecorder — noopAuditRecorder until Phase 7 Firestore persist).
 *
 * @see ADR-349 §Command Registration
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import {
  applyVertexDisplacement,
  translateEntityByAnchor,
  type WorldVector,
} from '../../../systems/stretch/stretch-entity-transform';
import type { VertexRef } from '../../../systems/stretch/stretch-vertex-classifier';
import type { Entity } from '../../../types/entities';
import { noopAuditRecorder, type IDxfTextAuditRecorder } from '../text/types';

type ReplacedEntry = { readonly oldEntity: SceneEntity; readonly newEntity: SceneEntity };

export interface StretchVertexMove {
  readonly entityId: string;
  readonly refs: ReadonlyArray<VertexRef>;
}

export interface StretchParams {
  readonly vertexMoves: ReadonlyArray<StretchVertexMove>;
  readonly anchorMoves: ReadonlyArray<string>;
  readonly displacement: WorldVector;
}

export class StretchEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'StretchEntities';
  readonly type = 'stretch-entities';
  readonly timestamp: number;

  private entitySnapshots: Map<string, SceneEntity> = new Map();
  private replacements: Map<string, ReplacedEntry> = new Map();
  private wasExecuted = false;

  constructor(
    private readonly params: StretchParams,
    private readonly sceneManager: ISceneManager,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.entitySnapshots.clear();
    this.replacements.clear();
    const { vertexMoves, anchorMoves, displacement } = this.params;

    for (const move of vertexMoves) {
      const entity = this.sceneManager.getEntity(move.entityId);
      if (!entity) continue;
      const result = applyVertexDisplacement(entity as unknown as Entity, move.refs, displacement);
      if (result.kind === 'noop') continue;
      const snapshot = deepClone(entity);
      this.entitySnapshots.set(move.entityId, snapshot);
      if (result.kind === 'update') {
        this.sceneManager.updateEntity(move.entityId, result.updates);
      } else {
        // Type-changing replacement (e.g. rectangle → polyline). Same id is
        // preserved by the math layer so selection/refs stay valid.
        this.replacements.set(move.entityId, { oldEntity: snapshot, newEntity: result.entity });
        this.sceneManager.removeEntity(move.entityId);
        this.sceneManager.addEntity(result.entity);
      }
    }

    for (const entityId of anchorMoves) {
      const entity = this.sceneManager.getEntity(entityId);
      if (!entity) continue;
      const updates = translateEntityByAnchor(entity as unknown as Entity, displacement);
      if (Object.keys(updates).length === 0) continue;
      this.entitySnapshots.set(entityId, deepClone(entity));
      this.sceneManager.updateEntity(entityId, updates);
    }

    this.wasExecuted = this.entitySnapshots.size > 0;
    if (this.wasExecuted) {
      const { x, y } = this.params.displacement;
      this.auditRecorder.record({
        entityId: this.id,
        action: 'updated',
        changes: [
          { field: 'op', oldValue: null, newValue: 'stretch' },
          { field: 'displacement', oldValue: { x: 0, y: 0 }, newValue: { x, y } },
          { field: 'affectedEntityIds', oldValue: null, newValue: this.getAffectedEntityIds() },
          { field: 'affectedEntityCount', oldValue: null, newValue: this.entitySnapshots.size },
        ],
        commandName: this.name,
        timestamp: Date.now(),
      });
    }
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const [entityId, snapshot] of this.entitySnapshots) {
      const replacement = this.replacements.get(entityId);
      if (replacement) {
        // Reverse the type-changing replacement: drop the new entity, restore old.
        this.sceneManager.removeEntity(replacement.newEntity.id);
        this.sceneManager.addEntity(replacement.oldEntity);
      } else {
        const { id: _id, layer: _layer, visible: _visible, ...geometry } = snapshot;
        this.sceneManager.updateEntity(entityId, geometry);
      }
    }
    const { x, y } = this.params.displacement;
    this.auditRecorder.record({
      entityId: this.id,
      action: 'updated',
      changes: [
        { field: 'op', oldValue: null, newValue: 'stretch-undo' },
        { field: 'displacement', oldValue: { x, y }, newValue: { x: -x, y: -y } },
      ],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  redo(): void {
    const { vertexMoves, anchorMoves, displacement } = this.params;
    for (const move of vertexMoves) {
      const snapshot = this.entitySnapshots.get(move.entityId);
      if (!snapshot) continue;
      const result = applyVertexDisplacement(snapshot as unknown as Entity, move.refs, displacement);
      if (result.kind === 'update') {
        this.sceneManager.updateEntity(move.entityId, result.updates);
      } else if (result.kind === 'replace') {
        this.sceneManager.removeEntity(move.entityId);
        this.sceneManager.addEntity(result.entity);
      }
    }
    for (const entityId of anchorMoves) {
      const snapshot = this.entitySnapshots.get(entityId);
      if (!snapshot) continue;
      const updates = translateEntityByAnchor(snapshot as unknown as Entity, displacement);
      if (Object.keys(updates).length > 0) this.sceneManager.updateEntity(entityId, updates);
    }
    const { x, y } = displacement;
    this.auditRecorder.record({
      entityId: this.id,
      action: 'updated',
      changes: [
        { field: 'op', oldValue: null, newValue: 'stretch' },
        { field: 'displacement', oldValue: { x: 0, y: 0 }, newValue: { x, y } },
        { field: 'affectedEntityIds', oldValue: null, newValue: this.getAffectedEntityIds() },
        { field: 'affectedEntityCount', oldValue: null, newValue: this.entitySnapshots.size },
      ],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  getDescription(): string {
    const count = this.entitySnapshots.size || (this.params.vertexMoves.length + this.params.anchorMoves.length);
    const { x, y } = this.params.displacement;
    return `Stretch ${count} ${count === 1 ? 'entity' : 'entities'} by Δ(${x.toFixed(3)}, ${y.toFixed(3)})`;
  }

  getAffectedEntityIds(): string[] {
    const ids = new Set<string>();
    for (const m of this.params.vertexMoves) ids.add(m.entityId);
    for (const id of this.params.anchorMoves) ids.add(id);
    return [...ids];
  }

  validate(): string | null {
    const total = this.params.vertexMoves.length + this.params.anchorMoves.length;
    if (total === 0) return 'At least one entity is required';
    const { x, y } = this.params.displacement;
    if (x === 0 && y === 0) return 'Displacement cannot be zero';
    return null;
  }

  serialize(): SerializedCommand {
    const snapshotsArray: Array<{ id: string; entity: SceneEntity }> = [];
    this.entitySnapshots.forEach((entity, id) => { snapshotsArray.push({ id, entity }); });
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        vertexMoves: this.params.vertexMoves,
        anchorMoves: this.params.anchorMoves,
        displacement: this.params.displacement,
        entitySnapshots: snapshotsArray,
      },
      version: 1,
    };
  }
}

