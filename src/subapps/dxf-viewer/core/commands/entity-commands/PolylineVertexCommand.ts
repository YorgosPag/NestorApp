/**
 * POLYLINE VERTEX COMMAND — ADR-349 Phase 1b.1
 *
 * Undoable command for inserting or removing a single vertex on a POLYLINE or
 * LWPOLYLINE. Grip-driven from the multifunctional grip menu.
 *
 * Phase 1b.1 scope: add / remove only. Convert-to-arc (bulge factor) lives in
 * {@link SetBulgeCommand} (ADR-510 Φ3c) — this command keeps the per-segment
 * parallel arrays (`bulges` / `startWidths` / `endWidths`) index-aligned with
 * `vertices` so an arc/width-bearing polyline survives add/remove edits.
 *
 * @see ADR-349 §Multifunctional Grip Menu — Polyline vertex add/remove/convert
 * @see SetBulgeCommand — ADR-510 Φ3c, the convert-to-arc / drag command
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { geometryFromSnapshot } from './snapshot-geometry';
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

  /**
   * Splice one entry into a per-segment parallel array (`bulges` / widths) so it
   * stays index-aligned with `vertices`. Insert ⇒ a 0 (straight / no-width) for
   * the new segment; remove ⇒ drop the removed vertex's outgoing entry. Returns
   * undefined when the source array is absent (polyline carries no arc/width).
   */
  private spliceParallel(
    arr: ReadonlyArray<number> | undefined,
    index: number,
    kind: 'add' | 'remove',
  ): number[] | undefined {
    if (!arr) return undefined;
    const next = arr.slice();
    if (kind === 'add') next.splice(index, 0, 0);
    else next.splice(index, 1);
    return next;
  }

  /**
   * Build the full vertex + parallel-array patch for the op, or null when the
   * index is out of range / the polyline would drop below 2 vertices.
   */
  private applyOp(poly: PolyEntity): Partial<SceneEntity> | null {
    const op = this.params.op;
    const vertices = poly.vertices;
    let nextVertices: Point2D[];
    if (op.kind === 'add') {
      if (op.index < 0 || op.index > vertices.length) return null;
      nextVertices = vertices.slice();
      nextVertices.splice(op.index, 0, op.position);
    } else {
      if (op.index < 0 || op.index >= vertices.length) return null;
      if (vertices.length <= 2) return null; // keep minimum
      nextVertices = vertices.slice();
      nextVertices.splice(op.index, 1);
    }
    const patch: Record<string, unknown> = { vertices: nextVertices };
    const bulges = this.spliceParallel(poly.bulges, op.index, op.kind);
    if (bulges) patch.bulges = bulges;
    const startWidths = this.spliceParallel(poly.startWidths, op.index, op.kind);
    if (startWidths) patch.startWidths = startWidths;
    const endWidths = this.spliceParallel(poly.endWidths, op.index, op.kind);
    if (endWidths) patch.endWidths = endWidths;
    return patch as Partial<SceneEntity>;
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.params.entityId);
    if (!entity) return;
    if (entity.type !== 'polyline' && entity.type !== 'lwpolyline') return;
    const poly = entity as unknown as PolyEntity;
    const patch = this.applyOp(poly);
    if (!patch) return;
    this.snapshot = deepClone(entity);
    this.sceneManager.updateEntity(this.params.entityId, patch);
  }

  undo(): void {
    if (!this.snapshot) return;
    const geometry = geometryFromSnapshot(this.snapshot);
    this.sceneManager.updateEntity(this.params.entityId, geometry);
  }

  redo(): void {
    if (!this.snapshot) return;
    const poly = this.snapshot as unknown as PolyEntity;
    const patch = this.applyOp(poly);
    if (patch) this.sceneManager.updateEntity(this.params.entityId, patch);
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
