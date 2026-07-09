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
 * Guards: the SOURCE layer must be editable (inherited resolve via {@link DxfTextCommandBase}),
 * AND the TARGET layer must resolve and be editable too (belt-and-suspenders — the dropdown
 * already hides frozen + disables locked layers). Discrete action (no merge). Undo restores
 * the previous `layerId`. ADR-614 — boilerplate inherited from the base.
 */

import type { SceneEntity } from '../interfaces';
import { DxfTextCommandBase } from './dxf-text-command-base';
import { assertCanEditLayer } from './CanEditLayerGuard';
// 🏢 ADR-358 — id-first LayerStore reader: target layer lookup.
import { getLayer } from '../../../stores/LayerStore';

export interface UpdateTextLayerCommandInput {
  readonly entityId: string;
  /** Target layer ID (the LayerStore id — the dropdown `SelectItem` value). */
  readonly layerId: string;
}

export class UpdateTextLayerCommand extends DxfTextCommandBase<UpdateTextLayerCommandInput> {
  readonly name = 'UpdateTextLayer';
  readonly type = 'update-text-layer';

  private previousLayerId: string | undefined;
  private captured = false;

  execute(): void {
    // Source resolve + editability (mirror DeleteTextCommand: id-first name via LayerStore).
    const entity = this.resolveEntity();
    if (!entity) return;
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
      this.entityId,
      { layerId: this.input.layerId } as unknown as Partial<SceneEntity>,
    );
    this.wasExecuted = true;
    this.recordAudit('updated', [
      { field: 'layerId', oldValue: this.previousLayerId ?? null, newValue: this.input.layerId },
    ]);
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.sceneManager.updateEntity(
      this.entityId,
      { layerId: this.previousLayerId } as unknown as Partial<SceneEntity>,
    );
    this.recordAudit('updated', [
      { field: 'layerId', oldValue: this.input.layerId, newValue: this.previousLayerId ?? null },
    ]);
  }

  getDescription(): string {
    return 'Move text to layer';
  }

  protected validatePayload(): string | null {
    if (!this.input.layerId) return 'layerId is required';
    return null;
  }

  protected serializeData(): Record<string, unknown> {
    return { entityId: this.entityId, layerId: this.input.layerId };
  }
}
