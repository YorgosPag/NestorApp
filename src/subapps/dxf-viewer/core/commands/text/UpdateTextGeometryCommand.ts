/**
 * ADR-344 Phase 6.A — UpdateTextGeometryCommand.
 *
 * Patches geometric attributes of a TEXT/MTEXT entity: position
 * (translate), rotation, MTEXT columns.width (resize). Used by the
 * grip handler (Phase 6.C). Style/content untouched.
 *
 * Merge: consecutive geometry updates on the same entity within the
 * default merge window collapse into one command — smooth drag undo.
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import type { DxfTextNode } from '../../../text-engine/types';
import type { Point2D } from '../../../rendering/types/Types';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from './types';
import { assertCanEditLayer } from './CanEditLayerGuard';
import { buildShallowDiff } from './diff-helpers';
import { ensureTextNode } from '../../../text-engine/edit/ensure-text-node';

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

export class UpdateTextGeometryCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateTextGeometry';
  readonly type = 'update-text-geometry';
  readonly timestamp: number;

  private snapshot: GeometrySnapshot | null = null;
  private wasExecuted = false;

  constructor(
    private readonly input: UpdateTextGeometryCommandInput,
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

    const safeNode = ensureTextNode(entity);
    if (!this.snapshot) {
      this.snapshot = {
        position: entity.position,
        rotation: safeNode.rotation,
        width: safeNode.columns?.width,
        textNode: safeNode,
      };
    }

    const { patch } = this.input;
    const nextNode: DxfTextNode = {
      ...safeNode,
      rotation: patch.rotation ?? safeNode.rotation,
      columns: safeNode.columns && patch.width !== undefined
        ? { ...safeNode.columns, width: patch.width }
        : safeNode.columns,
    };
    const nextPosition = patch.position ?? entity.position;
    this.sceneManager.updateEntity(this.input.entityId, {
      position: nextPosition,
      textNode: nextNode,
    });
    this.wasExecuted = true;

    this.auditRecorder.record({
      entityId: this.input.entityId,
      action: 'updated',
      changes: buildShallowDiff(
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
      ),
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    this.sceneManager.updateEntity(this.input.entityId, {
      position: this.snapshot.position,
      textNode: this.snapshot.textNode,
    });
  }

  redo(): void {
    this.execute();
  }

  canMergeWith(other: ICommand): boolean {
    if (other.type !== this.type) return false;
    const o = other as UpdateTextGeometryCommand;
    return o.input.entityId === this.input.entityId;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateTextGeometryCommand;
    return new UpdateTextGeometryCommand(
      {
        entityId: this.input.entityId,
        patch: { ...this.input.patch, ...o.input.patch },
      },
      this.sceneManager,
      this.layerProvider,
      this.auditRecorder,
    );
  }

  getDescription(): string {
    return `Update text geometry (${Object.keys(this.input.patch).join(', ') || 'no fields'})`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityId: this.input.entityId, patch: this.input.patch },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityId) return 'entityId is required';
    if (!this.input.patch || Object.keys(this.input.patch).length === 0) {
      return 'patch must not be empty';
    }
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [this.input.entityId];
  }
}
