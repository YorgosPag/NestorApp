/**
 * POLYLINE VERTEX COMMAND — ADR-349 Phase 1b.1
 *
 * Undoable command for inserting or removing a single vertex on a POLYLINE or
 * LWPOLYLINE. Grip-driven from the multifunctional grip menu.
 *
 * Phase 1b.1 scope: add / remove only.
 * Convert-to-arc (bulge factor) is deferred — the current entity model has no
 * `bulges[]` field; a separate ADR-GEOMETRY entry will introduce it.
 *
 * @see ADR-349 §Multifunctional Grip Menu — Polyline vertex add/remove/convert
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import type { PolylineEntity, LWPolylineEntity } from '../../../types/entities';

export type PolylineVertexOp =
  | { readonly kind: 'add'; readonly index: number; readonly position: Point2D }
  | { readonly kind: 'remove'; readonly index: number };

export interface PolylineVertexParams {
  readonly entityId: string;
  readonly op: PolylineVertexOp;
}

type PolyEntity = PolylineEntity | LWPolylineEntity;

export class PolylineVertexCommand implements ICommand {
  readonly id: string;
  readonly name = 'PolylineVertex';
  readonly type = 'polyline-vertex';
  readonly timestamp: number;

  private snapshot: SceneEntity | null = null;

  constructor(
    private readonly params: PolylineVertexParams,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  private applyOp(vertices: ReadonlyArray<Point2D>): Point2D[] | null {
    const op = this.params.op;
    if (op.kind === 'add') {
      if (op.index < 0 || op.index > vertices.length) return null;
      const next = vertices.slice();
      next.splice(op.index, 0, op.position);
      return next;
    }
    // remove
    if (op.index < 0 || op.index >= vertices.length) return null;
    if (vertices.length <= 2) return null; // keep minimum
    const next = vertices.slice();
    next.splice(op.index, 1);
    return next;
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.params.entityId);
    if (!entity) return;
    if (entity.type !== 'polyline' && entity.type !== 'lwpolyline') return;
    const poly = entity as unknown as PolyEntity;
    const next = this.applyOp(poly.vertices);
    if (!next) return;
    this.snapshot = deepClone(entity);
    this.sceneManager.updateEntity(this.params.entityId, { vertices: next } as Partial<SceneEntity>);
  }

  undo(): void {
    if (!this.snapshot) return;
    const { id: _id, layer: _layer, visible: _visible, ...geometry } = this.snapshot;
    this.sceneManager.updateEntity(this.params.entityId, geometry);
  }

  redo(): void {
    if (!this.snapshot) return;
    const poly = this.snapshot as unknown as PolyEntity;
    const next = this.applyOp(poly.vertices);
    if (next) this.sceneManager.updateEntity(this.params.entityId, { vertices: next } as Partial<SceneEntity>);
  }

  getDescription(): string {
    return this.params.op.kind === 'add'
      ? `Add vertex @ index ${this.params.op.index}`
      : `Remove vertex @ index ${this.params.op.index}`;
  }

  getAffectedEntityIds(): string[] {
    return [this.params.entityId];
  }

  validate(): string | null {
    if (!this.params.entityId) return 'Entity ID required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { params: this.params, snapshot: this.snapshot },
      version: 1,
    };
  }
}
