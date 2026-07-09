/**
 * ADR-344 Phase 6.A — ReplaceAllTextCommand.
 *
 * Bulk find/replace across one or more text entities. Audit emits ONE
 * 'updated' entry per affected entity AT EXECUTE TIME — undo does not
 * emit an audit entry (BULK undo is a UI-level operation, not a separate
 * historical event). Idempotent: stored snapshots per entity guarantee
 * exact restore on undo.
 *
 * ADR-614 — a multi-entity outlier: extends the generic {@link BaseCommand}
 * (id/timestamp/redo/serialize envelope) and reuses the shared guarded-resolve
 * + audit-envelope free helpers, rather than the single-entity text bases.
 */

import type { ISceneManager } from '../interfaces';
import type { DxfTextNode } from '../../../text-engine/types';
import { BaseCommand } from '../base-command';
import { replaceAll, type MatchOptions } from './text-match-engine';
import {
  resolveEditableTextEntity,
  recordTextAudit,
} from './dxf-text-command-base';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from './types';

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

export class ReplaceAllTextCommand extends BaseCommand {
  readonly name = 'ReplaceAllText';
  readonly type = 'replace-all-text';

  private snapshots: EntitySnapshot[] = [];
  private wasExecuted = false;

  constructor(
    private readonly input: ReplaceAllTextCommandInput,
    private readonly sceneManager: ISceneManager,
    private readonly layerProvider: ILayerAccessProvider,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    super();
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
      const entity = resolveEditableTextEntity(entityId, this.sceneManager, this.layerProvider);
      if (!entity) continue;
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

    for (const snap of snapshots) {
      recordTextAudit(this.auditRecorder, this.name, snap.entityId, 'updated', [
        { field: 'pattern', oldValue: null, newValue: this.input.pattern },
        { field: 'replacement', oldValue: null, newValue: this.input.replacement },
        { field: 'replacements', oldValue: 0, newValue: snap.replacements },
      ]);
    }
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const snap of this.snapshots) {
      this.sceneManager.updateEntity(snap.entityId, { textNode: snap.textNode });
    }
  }

  getDescription(): string {
    const total = this.snapshots.reduce((s, x) => s + x.replacements, 0);
    return `Replace all "${this.input.pattern}" → "${this.input.replacement}" (${total} replacement${total === 1 ? '' : 's'})`;
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

  protected serializeData(): Record<string, unknown> {
    return {
      entityIds: [...this.input.entityIds],
      pattern: this.input.pattern,
      replacement: this.input.replacement,
      matchOptions: this.input.matchOptions as unknown as Record<string, unknown>,
    };
  }
}
