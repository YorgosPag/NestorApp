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
 *
 * ADR-614 — command lifecycle inherited from {@link DxfTextNodeMutationCommand}.
 */

import type { ICommand } from '../interfaces';
import type { DxfTextNode } from '../../../text-engine/types';
import {
  DxfTextNodeMutationCommand,
  type TextNodeMutationResult,
} from './dxf-text-command-base';

export interface UpdateTextCurrentScaleCommandInput {
  readonly entityId: string;
  readonly scaleName: string;
}

export class UpdateTextCurrentScaleCommand extends DxfTextNodeMutationCommand<UpdateTextCurrentScaleCommandInput> {
  readonly name = 'UpdateTextCurrentScale';
  readonly type = 'update-text-current-scale';

  protected applyMutation(_entity: unknown, node: DxfTextNode): TextNodeMutationResult {
    const nextNode: DxfTextNode = { ...node, currentScale: this.input.scaleName };
    return {
      updates: { textNode: nextNode },
      changes: [{ field: 'currentScale', oldValue: node.currentScale, newValue: this.input.scaleName }],
    };
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

  protected validatePayload(): string | null {
    if (!this.input.scaleName) return 'scaleName is required';
    return null;
  }

  protected serializeData(): Record<string, unknown> {
    return { entityId: this.input.entityId, scaleName: this.input.scaleName };
  }
}
