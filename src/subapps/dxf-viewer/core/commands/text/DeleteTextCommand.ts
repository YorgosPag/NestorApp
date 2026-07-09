/**
 * ADR-344 Phase 6.A — DeleteTextCommand.
 *
 * Removes a TEXT/MTEXT entity from the scene. Captures the full snapshot
 * before deletion so undo can restore the exact entity (id preserved,
 * AST preserved). Audit records DELETE on execute and CREATE-like on
 * undo so the trail captures both directions.
 *
 * ADR-614 — boilerplate (resolve+guard, audit, affected-ids, validate) is
 * inherited from {@link DxfTextCommandBase}; only the delete/restore behaviour
 * lives here.
 */

import { DxfTextCommandBase } from './dxf-text-command-base';
import type { DxfTextSceneEntity } from './types';

export interface DeleteTextCommandInput {
  readonly entityId: string;
}

export class DeleteTextCommand extends DxfTextCommandBase<DeleteTextCommandInput> {
  readonly name = 'DeleteText';
  readonly type = 'delete-text';

  private snapshot: DxfTextSceneEntity | null = null;

  execute(): void {
    const entity = this.resolveEntity();
    if (!entity) return;
    if (!this.snapshot) this.snapshot = entity;
    this.sceneManager.removeEntity(this.entityId);
    this.wasExecuted = true;
    this.recordAudit('deleted', [{ field: 'entity', oldValue: entity.type, newValue: null }]);
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    this.sceneManager.addEntity(this.snapshot);
    this.recordAudit(
      'created',
      [{ field: 'entity', oldValue: null, newValue: this.snapshot.type }],
      this.snapshot.id,
    );
  }

  getDescription(): string {
    return `Delete ${this.snapshot?.type.toUpperCase() ?? 'text'}`;
  }

  protected serializeData(): Record<string, unknown> {
    return { entityId: this.entityId };
  }
}
