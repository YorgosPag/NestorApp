/**
 * ARC RADIUS EDIT COMMAND — ADR-349 Phase 1b.1
 *
 * Undoable command for arc midpoint grip → new radius. Both endpoints stay fixed.
 * Accepts either a new midpoint (drag) or a new absolute radius (typed input).
 *
 * @see ADR-349 §Multifunctional Grip Menu — ARC Radius edit
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { editArcFromMidpoint, editArcFromRadius } from '../../../systems/grip/arc-radius-edit';
import type { ArcEntity } from '../../../types/entities';

export type ArcRadiusInput =
  | { readonly kind: 'midpoint'; readonly newMidpoint: Point2D }
  | { readonly kind: 'radius'; readonly newRadius: number };

export interface ArcRadiusEditParams {
  readonly entityId: string;
  readonly input: ArcRadiusInput;
}

export class ArcRadiusEditCommand implements ICommand {
  readonly id: string;
  readonly name = 'ArcRadiusEdit';
  readonly type = 'arc-radius-edit';
  readonly timestamp: number;

  private snapshot: SceneEntity | null = null;

  constructor(
    private readonly params: ArcRadiusEditParams,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  private computeUpdates(arc: ArcEntity): Partial<ArcEntity> | null {
    const result = this.params.input.kind === 'midpoint'
      ? editArcFromMidpoint(arc, this.params.input.newMidpoint)
      : editArcFromRadius(arc, this.params.input.newRadius);
    return result;
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.params.entityId);
    if (!entity || entity.type !== 'arc') return;
    const updates = this.computeUpdates(entity as unknown as ArcEntity);
    if (!updates) return;
    this.snapshot = deepClone(entity);
    this.sceneManager.updateEntity(this.params.entityId, updates as Partial<SceneEntity>);
  }

  undo(): void {
    if (!this.snapshot) return;
    const { id: _id, layer: _layer, visible: _visible, ...geometry } = this.snapshot;
    this.sceneManager.updateEntity(this.params.entityId, geometry);
  }

  redo(): void {
    if (!this.snapshot) return;
    const updates = this.computeUpdates(this.snapshot as unknown as ArcEntity);
    if (updates) this.sceneManager.updateEntity(this.params.entityId, updates as Partial<SceneEntity>);
  }

  getDescription(): string {
    if (this.params.input.kind === 'radius') {
      return `Arc radius → ${this.params.input.newRadius.toFixed(3)}`;
    }
    const { x, y } = this.params.input.newMidpoint;
    return `Arc midpoint → (${x.toFixed(3)}, ${y.toFixed(3)})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.params.entityId];
  }

  validate(): string | null {
    if (!this.params.entityId) return 'Entity ID required';
    if (this.params.input.kind === 'radius' && this.params.input.newRadius <= 0) {
      return 'Radius must be positive';
    }
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
