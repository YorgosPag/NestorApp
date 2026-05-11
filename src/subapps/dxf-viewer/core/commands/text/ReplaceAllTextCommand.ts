/**
 * ADR-344 Phase 6.A — ReplaceAllTextCommand.
 *
 * Bulk find/replace across one or more text entities. Audit emits ONE
 * 'updated' entry per affected entity AT EXECUTE TIME — undo does not
 * emit an audit entry (BULK undo is a UI-level operation, not a separate
 * historical event). Idempotent: stored snapshots per entity guarantee
 * exact restore on undo.
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
import { replaceAll, type MatchOptions } from './text-match-engine';

export interface ReplaceAllTextCommandInput {
  readonly entityIds: readonly string[];
  readonly pattern: string;
  readonly replacement: string;
  readonly matchOptions: MatchOptions;
}

interface EntitySnapshot {
  readonly entityId: string;
  readonly textNode: DxfTextNode;
  readonly replacements: number;
}

export class ReplaceAllTextCommand implements ICommand {
  readonly id: string;
  readonly name = 'ReplaceAllText';
  readonly type = 'replace-all-text';
  readonly timestamp: number;

  private snapshots: EntitySnapshot[] = [];
  private wasExecuted = false;

  constructor(
    private readonly input: ReplaceAllTextCommandInput,
    private readonly sceneManager: ISceneManager,
    private readonly layerProvider: ILayerAccessProvider,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.wasExecuted) {
      // redo path — re-apply stored final states via re-derivation
      for (const snap of this.snapshots) {
        const entity = this.sceneManager.getEntity(snap.entityId) as
          | DxfTextSceneEntity
          | undefined;
        if (!entity) continue;
        const { node } = replaceAll(
          entity.textNode,
          this.input.pattern,
          this.input.replacement,
          this.input.matchOptions,
        );
        this.sceneManager.updateEntity(snap.entityId, { textNode: node });
      }
      return;
    }

    const snapshots: EntitySnapshot[] = [];
    for (const entityId of this.input.entityIds) {
      const entity = this.sceneManager.getEntity(entityId) as
        | DxfTextSceneEntity
        | undefined;
      if (!entity) continue;
      assertCanEditLayer({ layerName: entity.layer, provider: this.layerProvider });
      const { node, count } = replaceAll(
        entity.textNode,
        this.input.pattern,
        this.input.replacement,
        this.input.matchOptions,
      );
      if (count === 0) continue;
      snapshots.push({ entityId, textNode: entity.textNode, replacements: count });
      this.sceneManager.updateEntity(entityId, { textNode: node });
    }
    this.snapshots = snapshots;
    this.wasExecuted = true;

    const totalReplacements = snapshots.reduce((sum, s) => sum + s.replacements, 0);
    for (const snap of snapshots) {
      this.auditRecorder.record({
        entityId: snap.entityId,
        action: 'updated',
        changes: [
          { field: 'pattern', oldValue: null, newValue: this.input.pattern },
          { field: 'replacement', oldValue: null, newValue: this.input.replacement },
          { field: 'replacements', oldValue: 0, newValue: snap.replacements },
        ],
        commandName: this.name,
        timestamp: Date.now(),
      });
    }
    void totalReplacements;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const snap of this.snapshots) {
      this.sceneManager.updateEntity(snap.entityId, { textNode: snap.textNode });
    }
  }

  redo(): void {
    this.execute();
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    const total = this.snapshots.reduce((s, x) => s + x.replacements, 0);
    return `Replace all "${this.input.pattern}" → "${this.input.replacement}" (${total} replacement${total === 1 ? '' : 's'})`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityIds: [...this.input.entityIds],
        pattern: this.input.pattern,
        replacement: this.input.replacement,
        matchOptions: this.input.matchOptions as unknown as Record<string, unknown>,
      },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityIds || this.input.entityIds.length === 0) {
      return 'entityIds must not be empty';
    }
    if (!this.input.pattern) return 'pattern must not be empty';
    return null;
  }

  getAffectedEntityIds(): string[] {
    return this.snapshots.map((s) => s.entityId);
  }
}
