/**
 * LENGTHEN COMMAND — ADR-349 Phase 1b.1
 *
 * Undoable command for axial-length adjustment of a LINE or ARC endpoint.
 * Grip-driven only (Phase 1) — invoked from the multifunctional grip menu.
 * Standalone LENGTHEN ribbon command is deferred to a future ADR.
 *
 * @see ADR-349 §Multifunctional Grip Menu
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import {
  applyLengthen,
  type LengthenEndpoint,
  type LengthenMode,
} from '../../../systems/grip/lengthen-axial-stretch';
import type { Entity } from '../../../types/entities';

export interface LengthenParams {
  readonly entityId: string;
  readonly endpoint: LengthenEndpoint;
  readonly value: number;
  readonly mode: LengthenMode;
}

export class LengthenCommand implements ICommand {
  readonly id: string;
  readonly name = 'LengthenEntity';
  readonly type = 'lengthen-entity';
  readonly timestamp: number;

  private snapshot: SceneEntity | null = null;

  constructor(
    private readonly params: LengthenParams,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.params.entityId);
    if (!entity) return;
    const updates = applyLengthen(
      entity as unknown as Entity,
      this.params.endpoint,
      this.params.value,
      this.params.mode,
    );
    if (Object.keys(updates).length === 0) return;
    this.snapshot = deepClone(entity);
    this.sceneManager.updateEntity(this.params.entityId, updates);
  }

  undo(): void {
    if (!this.snapshot) return;
    const { id: _id, layer: _layer, visible: _visible, ...geometry } = this.snapshot;
    this.sceneManager.updateEntity(this.params.entityId, geometry);
  }

  redo(): void {
    if (!this.snapshot) return;
    const updates = applyLengthen(
      this.snapshot as unknown as Entity,
      this.params.endpoint,
      this.params.value,
      this.params.mode,
    );
    if (Object.keys(updates).length > 0) {
      this.sceneManager.updateEntity(this.params.entityId, updates);
    }
  }

  getDescription(): string {
    const sign = this.params.mode === 'delta' ? (this.params.value >= 0 ? '+' : '') : '=';
    return `Lengthen ${this.params.endpoint} ${sign}${this.params.value.toFixed(3)}`;
  }

  getAffectedEntityIds(): string[] {
    return [this.params.entityId];
  }

  validate(): string | null {
    if (!this.params.entityId) return 'Entity ID required';
    if (this.params.mode === 'total' && this.params.value <= 0) return 'Total length must be positive';
    if (this.params.mode === 'delta' && this.params.value === 0) return 'Delta cannot be zero';
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
