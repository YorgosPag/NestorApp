/**
 * ADR-344 Phase 6.E — ReplaceTextNodeCommand.
 *
 * Atomic replacement of the entire DxfTextNode on a single TEXT/MTEXT
 * entity. Used as the "content carrier" inside the TipTap commit
 * pipeline (Phase 6.E Layer 3): the diff engine emits one of these
 * whenever paragraph structure or run content changes — fields that
 * `UpdateMTextParagraphCommand` cannot patch because its `ParagraphPatch`
 * type intentionally excludes `runs`.
 *
 * AutoCAD parity: equivalent to the `MTEXTEDIT` undo entry — one entry
 * regardless of how many characters changed inside the editor session.
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

export interface ReplaceTextNodeCommandInput {
  readonly entityId: string;
  readonly nextNode: DxfTextNode;
}

export class ReplaceTextNodeCommand implements ICommand {
  readonly id: string;
  readonly name = 'ReplaceTextNode';
  readonly type = 'replace-text-node';
  readonly timestamp: number;

  private snapshot: DxfTextNode | null = null;
  private wasExecuted = false;

  constructor(
    private readonly input: ReplaceTextNodeCommandInput,
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

    if (!this.snapshot) this.snapshot = ensureTextNode(entity);
    this.sceneManager.updateEntity(this.input.entityId, {
      textNode: this.input.nextNode,
    });
    this.wasExecuted = true;

    this.auditRecorder.record({
      entityId: this.input.entityId,
      action: 'updated',
      changes: [
        {
          field: 'textNode',
          oldValue: 'replaced',
          newValue: 'replaced',
        },
      ],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    this.sceneManager.updateEntity(this.input.entityId, {
      textNode: this.snapshot,
    });
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Replace text node (${this.input.entityId})`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityId: this.input.entityId,
        nextNode: this.input.nextNode as unknown as Record<string, unknown>,
      },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityId) return 'entityId is required';
    if (!this.input.nextNode) return 'nextNode is required';
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [this.input.entityId];
  }
}
