/**
 * ADR-344 Phase 6.A — DeleteTextCommand.
 *
 * Removes a TEXT/MTEXT entity from the scene. Captures the full snapshot
 * before deletion so undo can restore the exact entity (id preserved,
 * AST preserved). Audit records DELETE on execute and CREATE-like on
 * undo so the trail captures both directions.
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from './types';
import { assertCanEditLayer } from './CanEditLayerGuard';

export interface DeleteTextCommandInput {
  readonly entityId: string;
}

export class DeleteTextCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteText';
  readonly type = 'delete-text';
  readonly timestamp: number;

  private snapshot: DxfTextSceneEntity | null = null;
  private wasExecuted = false;

  constructor(
    private readonly input: DeleteTextCommandInput,
    private readonly sceneManager: ISceneManager,
    private readonly layerProvider: ILayerAccessProvider,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.input.entityId) as
      | DxfTextSceneEntity
      | undefined;
    if (!entity) return;
    assertCanEditLayer({ layerName: entity.layer, provider: this.layerProvider });
    if (!this.snapshot) this.snapshot = entity;
    this.sceneManager.removeEntity(this.input.entityId);
    this.wasExecuted = true;
    this.auditRecorder.record({
      entityId: this.input.entityId,
      action: 'deleted',
      changes: [{ field: 'entity', oldValue: entity.type, newValue: null }],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    this.sceneManager.addEntity(this.snapshot);
    this.auditRecorder.record({
      entityId: this.snapshot.id,
      action: 'created',
      changes: [{ field: 'entity', oldValue: null, newValue: this.snapshot.type }],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  redo(): void {
    this.execute();
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Delete ${this.snapshot?.type.toUpperCase() ?? 'text'}`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityId: this.input.entityId },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityId) return 'entityId is required';
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [this.input.entityId];
  }
}
