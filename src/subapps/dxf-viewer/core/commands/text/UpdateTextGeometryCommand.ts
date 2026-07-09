/**
 * ADR-344 Phase 6.A — UpdateTextGeometryCommand.
 *
 * Patches geometric attributes of a TEXT/MTEXT entity: position
 * (translate), rotation, MTEXT columns.width (resize). Used by the
 * grip handler (Phase 6.C). Style/content untouched.
 *
 * Merge: consecutive geometry updates on the same entity within the
 * default merge window collapse into one command — smooth drag undo.
 *
 * ADR-614 — boilerplate inherited from {@link DxfTextCommandBase}; the geometry
 * snapshot spans flat fields + node, so execute/undo are bespoke here.
 */

import type { ICommand } from '../interfaces';
import type { DxfTextNode } from '../../../text-engine/types';
import type { Point2D } from '../../../rendering/types/Types';
import { buildShallowDiff } from './diff-helpers';
import { ensureTextNode } from '../../../text-engine/edit/ensure-text-node';
import {
  DxfTextCommandBase,
  mergePatchInputs,
  validateNonEmptyPatch,
  describePatchFields,
} from './dxf-text-command-base';

export interface GeometryPatch {
  /** Absolute insertion point (drawing units). */
  position?: Point2D;
  /** Absolute rotation in degrees. */
  rotation?: number;
  /** MTEXT frame width (drawing units). Ignored for TEXT. */
  width?: number;
}

export interface UpdateTextGeometryCommandInput {
  readonly entityId: string;
  readonly patch: GeometryPatch;
}

interface GeometrySnapshot {
  position: Point2D;
  rotation: number;
  width: number | undefined;
  textNode: DxfTextNode;
}

export class UpdateTextGeometryCommand extends DxfTextCommandBase<UpdateTextGeometryCommandInput> {
  readonly name = 'UpdateTextGeometry';
  readonly type = 'update-text-geometry';

  private snapshot: GeometrySnapshot | null = null;

  execute(): void {
    const entity = this.resolveEntity();
    if (!entity) return;

    const safeNode = ensureTextNode(entity);
    // ADR-557 — rotation SSoT is the FLAT `entity.rotation` (the converter reads
    // `e.rotation` → render EntityModel `te.rotation`, and the grip commit
    // `UpdateTextTransformCommand` writes it flat). Snapshot/read/write the flat field so
    // a ribbon rotation actually spins the canvas; `textNode.rotation` is kept in sync.
    const currentRotation = (entity as { rotation?: number }).rotation ?? safeNode.rotation ?? 0;
    if (!this.snapshot) {
      this.snapshot = {
        position: entity.position,
        rotation: currentRotation,
        width: safeNode.columns?.width,
        textNode: safeNode,
      };
    }

    const { patch } = this.input;
    const nextRotation = patch.rotation ?? currentRotation;
    const nextNode: DxfTextNode = {
      ...safeNode,
      rotation: nextRotation,
      columns: safeNode.columns && patch.width !== undefined
        ? { ...safeNode.columns, width: patch.width }
        : safeNode.columns,
    };
    const nextPosition = patch.position ?? entity.position;
    this.sceneManager.updateEntity(this.entityId, {
      position: nextPosition,
      // Flat rotation = the field the renderer/converter/read-selector all read (ADR-557).
      rotation: nextRotation,
      textNode: nextNode,
    });
    this.wasExecuted = true;

    this.recordAudit('updated', buildShallowDiff(
      {
        position: this.snapshot.position,
        rotation: this.snapshot.rotation,
        width: this.snapshot.width,
      },
      {
        position: nextPosition,
        rotation: nextNode.rotation,
        width: nextNode.columns?.width,
      },
    ));
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    this.sceneManager.updateEntity(this.entityId, {
      position: this.snapshot.position,
      // Restore the flat rotation SSoT (ADR-557) alongside the textNode.
      rotation: this.snapshot.rotation,
      textNode: this.snapshot.textNode,
    });
  }

  canMergeWith(other: ICommand): boolean {
    if (other.type !== this.type) return false;
    return (other as UpdateTextGeometryCommand).input.entityId === this.input.entityId;
  }

  mergeWith(other: ICommand): ICommand {
    const merged = mergePatchInputs(this.input, (other as UpdateTextGeometryCommand).input);
    return new UpdateTextGeometryCommand(merged, this.sceneManager, this.layerProvider, this.auditRecorder);
  }

  protected validatePayload(): string | null {
    return validateNonEmptyPatch(this.input.patch);
  }

  getDescription(): string {
    return describePatchFields('Update text geometry', this.input.patch);
  }

  protected serializeData(): Record<string, unknown> {
    return { entityId: this.entityId, patch: this.input.patch };
  }
}
