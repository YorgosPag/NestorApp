/**
 * ADR-344 Phase 6.A — ReplaceOneTextCommand.
 *
 * Replaces a single match at a specific location inside one entity.
 * Used by the Find&Replace UI when the user presses "Replace" (not
 * "Replace All"). Exactly one audit entry per execution.
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
import { replaceAt, type MatchLocation } from './text-match-engine';

export interface ReplaceOneTextCommandInput {
  readonly entityId: string;
  readonly location: MatchLocation;
  readonly replacement: string;
  /** Original matched text (audit + redo verification). */
  readonly originalText: string;
}

export class ReplaceOneTextCommand implements ICommand {
  readonly id: string;
  readonly name = 'ReplaceOneText';
  readonly type = 'replace-one-text';
  readonly timestamp: number;

  private snapshot: DxfTextNode | null = null;
  private wasExecuted = false;

  constructor(
    private readonly input: ReplaceOneTextCommandInput,
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
    if (!this.snapshot) this.snapshot = entity.textNode;

    const { node, replaced } = replaceAt(
      entity.textNode,
      this.input.location,
      this.input.replacement,
    );
    if (!replaced) return;
    this.sceneManager.updateEntity(this.input.entityId, { textNode: node });
    this.wasExecuted = true;

    this.auditRecorder.record({
      entityId: this.input.entityId,
      action: 'updated',
      changes: [
        { field: 'text', oldValue: this.input.originalText, newValue: this.input.replacement },
        { field: 'paragraph', oldValue: null, newValue: this.input.location.paragraphIndex },
        { field: 'run', oldValue: null, newValue: this.input.location.runIndex },
      ],
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

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Replace "${this.input.originalText}" → "${this.input.replacement}"`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityId: this.input.entityId,
        location: this.input.location as unknown as Record<string, unknown>,
        replacement: this.input.replacement,
        originalText: this.input.originalText,
      },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityId) return 'entityId is required';
    if (this.input.location.start >= this.input.location.end) {
      return 'location end must be greater than start';
    }
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [this.input.entityId];
  }
}
