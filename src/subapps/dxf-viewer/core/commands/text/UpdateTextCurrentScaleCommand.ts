/**
 * ADR-344 Phase 6.E follow-up — UpdateTextCurrentScaleCommand.
 *
 * Sets the active annotation scale on a single TEXT/MTEXT entity
 * (`textNode.currentScale`). Caller is also responsible for syncing the
 * global ViewportStore.activeScale so the rendering resolver picks the
 * matching height from the entity's annotationScales list.
 *
 * AutoCAD parity: equivalent to selecting a scale from the OBJECTSCALE
 * dialog's "Add Current Scale" / "Current Scale" combobox — the entity's
 * preferred scale is updated; the viewport scale is synced separately.
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import type { DxfTextNode } from '../../../text-engine/types';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from './types';
import { assertCanEditLayer } from './CanEditLayerGuard';
import { ensureTextNode } from '../../../text-engine/edit/ensure-text-node';

export interface UpdateTextCurrentScaleCommandInput {
  readonly entityId: string;
  readonly scaleName: string;
}

export class UpdateTextCurrentScaleCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateTextCurrentScale';
  readonly type = 'update-text-current-scale';
  readonly timestamp: number;

  private snapshot: DxfTextNode | null = null;
  private wasExecuted = false;

  constructor(
    private readonly input: UpdateTextCurrentScaleCommandInput,
    private readonly sceneManager: ISceneManager,
    private readonly layerProvider: ILayerAccessProvider,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.input.entityId) as DxfTextSceneEntity | undefined;
    if (!entity) return;
    assertCanEditLayer({ layerName: entity.layer, provider: this.layerProvider });

    const safeNode = ensureTextNode(entity);
    if (!this.snapshot) this.snapshot = safeNode;

    const nextNode: DxfTextNode = {
      ...safeNode,
      currentScale: this.input.scaleName,
    };
    this.sceneManager.updateEntity(this.input.entityId, { textNode: nextNode });
    this.wasExecuted = true;

    this.auditRecorder.record({
      entityId: this.input.entityId,
      action: 'updated',
      changes: [{ field: 'currentScale', oldValue: safeNode.currentScale, newValue: this.input.scaleName }],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    this.sceneManager.updateEntity(this.input.entityId, { textNode: this.snapshot });
  }

  redo(): void {
    this.execute();
  }

  canMergeWith(other: ICommand): boolean {
    if (other.type !== this.type) return false;
    return (other as UpdateTextCurrentScaleCommand).input.entityId === this.input.entityId;
  }

  mergeWith(other: ICommand): ICommand {
    return other;
  }

  getDescription(): string {
    return `Set annotation scale to ${this.input.scaleName}`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityId: this.input.entityId, scaleName: this.input.scaleName },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityId) return 'entityId is required';
    if (!this.input.scaleName) return 'scaleName is required';
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [this.input.entityId];
  }
}
