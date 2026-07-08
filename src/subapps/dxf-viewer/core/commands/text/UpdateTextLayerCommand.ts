/**
 * ADR-557 E-α — UpdateTextLayerCommand.
 *
 * Moves a text/mtext entity to another layer by patching the TOP-LEVEL `layerId` — the
 * single field the renderer + style/colour pipeline read (`LayerStore.resolveEntityLayerName`
 * is id-first; the per-type persistence services write `payload.layerId`). Before this, the
 * text toolbar's Layer picker was a NO-OP (`useTextToolbarCommandBridge` "layerId — deferred"):
 * no command changed an existing entity's layer — the `core/commands/layer/*` commands only
 * toggle layer STATE (isolate/freeze/lock/off/dim), and `CreateEntityCommand` sets `layerId`
 * ONLY at creation.
 *
 * The patch itself is entity-agnostic (only `layerId`); it is named "Text" for its toolbar
 * provenance. Reuse for non-text entities (a generic PROPERTIES "move to layer") is a
 * documented follow-up.
 *
 * Guards (mirror `DeleteTextCommand`): the SOURCE layer must be editable, AND the TARGET layer
 * must resolve and be editable too (belt-and-suspenders — the dropdown already hides frozen +
 * disables locked layers). Discrete action (no merge). Undo restores the previous `layerId`.
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from './types';
import { assertCanEditLayer } from './CanEditLayerGuard';
// 🏢 ADR-358 — id-first LayerStore readers: source name (audit/guard) + target layer lookup.
import { resolveEntityLayerName, getLayer } from '../../../stores/LayerStore';

export interface UpdateTextLayerCommandInput {
  readonly entityId: string;
  /** Target layer ID (the LayerStore id — the dropdown `SelectItem` value). */
  readonly layerId: string;
}

export class UpdateTextLayerCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateTextLayer';
  readonly type = 'update-text-layer';
  readonly timestamp: number;

  private previousLayerId: string | undefined;
  private captured = false;
  private wasExecuted = false;

  constructor(
    private readonly input: UpdateTextLayerCommandInput,
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
    // Source must be editable (mirror DeleteTextCommand: id-first name via LayerStore).
    assertCanEditLayer({ layerName: resolveEntityLayerName(entity) ?? '', provider: this.layerProvider });
    // Target must resolve AND be editable — no dropping onto an unknown / locked / frozen layer.
    const targetLayer = getLayer(this.input.layerId);
    if (!targetLayer) return;
    assertCanEditLayer({ layerName: targetLayer.name, provider: this.layerProvider });

    if (!this.captured) {
      this.previousLayerId = (entity as { layerId?: string }).layerId;
      this.captured = true;
    }
    if (this.previousLayerId === this.input.layerId) return; // already on the target layer

    this.sceneManager.updateEntity(
      this.input.entityId,
      { layerId: this.input.layerId } as unknown as Partial<SceneEntity>,
    );
    this.wasExecuted = true;
    this.auditRecorder.record({
      entityId: this.input.entityId,
      action: 'updated',
      changes: [{ field: 'layerId', oldValue: this.previousLayerId ?? null, newValue: this.input.layerId }],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.sceneManager.updateEntity(
      this.input.entityId,
      { layerId: this.previousLayerId } as unknown as Partial<SceneEntity>,
    );
    this.auditRecorder.record({
      entityId: this.input.entityId,
      action: 'updated',
      changes: [{ field: 'layerId', oldValue: this.input.layerId, newValue: this.previousLayerId ?? null }],
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
    return 'Move text to layer';
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityId: this.input.entityId, layerId: this.input.layerId },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityId) return 'entityId is required';
    if (!this.input.layerId) return 'layerId is required';
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [this.input.entityId];
  }
}
