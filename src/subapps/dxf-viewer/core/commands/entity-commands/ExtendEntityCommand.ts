/**
 * EXTEND ENTITY COMMAND — ADR-353
 *
 * Undoable atomic command for a single EXTEND pick. Each pick produces one
 * command in {@link CommandHistory} (Q7 — one undo step per pick).
 *
 * Operations:
 *  - extend → updateEntity with new geometry (endpoint moved to boundary intersection)
 *  - noOp   → no mutation (no boundary found, recorded for audit trace only)
 *
 * Undo restores every snapshot in reverse order.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-353-extend-command.md §Command
 */

import { generateEntityId } from '@/services/enterprise-id.service';
import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { noopAuditRecorder, type IDxfTextAuditRecorder } from '../text/types';
import type { ExtendOperation } from '../../../systems/extend/extend-types';
import type { Entity } from '../../../types/entities';

export interface ExtendCommandParams {
  readonly operations: ReadonlyArray<ExtendOperation>;
  readonly pickPoint: { x: number; y: number };
}

export class ExtendEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'ExtendEntities';
  readonly type = 'extend-entities';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly params: ExtendCommandParams,
    private readonly sceneManager: ISceneManager,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const effectiveOps = this.params.operations.filter((op) => op.kind === 'extend');
    for (const op of effectiveOps) this.applyOperation(op);
    this.wasExecuted = effectiveOps.length > 0;
    if (this.wasExecuted) this.recordAudit('extend');
  }

  undo(): void {
    if (!this.wasExecuted) return;
    const effectiveOps = this.params.operations.filter((op) => op.kind === 'extend');
    for (let i = effectiveOps.length - 1; i >= 0; i--) {
      this.revertOperation(effectiveOps[i]);
    }
    this.recordAudit('extend-undo');
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    const n = this.params.operations.filter((op) => op.kind === 'extend').length;
    return `Extend ${n} ${n === 1 ? 'entity' : 'entities'}`;
  }

  getAffectedEntityIds(): string[] {
    return this.params.operations
      .filter((op) => op.kind === 'extend')
      .map((op) => op.entityId);
  }

  validate(): string | null {
    if (this.params.operations.length === 0) return 'At least one operation is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        operations: this.params.operations as unknown as Record<string, unknown>[],
        pickPoint: this.params.pickPoint,
      },
      version: 1,
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private applyOperation(op: ExtendOperation): void {
    if (op.kind !== 'extend') return;
    const updates = this.geometryUpdates(op.newGeom);
    this.sceneManager.updateEntity(op.entityId, updates);
  }

  private revertOperation(op: ExtendOperation): void {
    if (op.kind !== 'extend') return;
    const updates = this.geometryUpdates(op.originalGeom);
    this.sceneManager.updateEntity(op.entityId, updates);
  }

  private geometryUpdates(entity: Readonly<Entity>): Partial<SceneEntity> {
    const { id: _id, type: _type, layer: _layer, visible: _v, ...rest } = entity as unknown as SceneEntity & Record<string, unknown>;
    return rest as Partial<SceneEntity>;
  }

  private recordAudit(op: 'extend' | 'extend-undo'): void {
    this.auditRecorder.record({
      entityId: this.id,
      action: 'updated',
      changes: [
        { field: 'op', oldValue: null, newValue: op },
        { field: 'pickPoint', oldValue: null, newValue: this.params.pickPoint },
        { field: 'affectedEntityIds', oldValue: null, newValue: this.getAffectedEntityIds() },
        { field: 'operationCount', oldValue: null, newValue: this.params.operations.length },
      ],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }
}
