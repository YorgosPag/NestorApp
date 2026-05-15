/**
 * TRIM ENTITY COMMAND — ADR-350
 *
 * Undoable atomic command for a single TRIM pick. Each pick produces one
 * command in {@link CommandHistory} (Q10 — one undo step per pick).
 *
 * Each {@link TrimOperation} mutates the scene atomically:
 *   - shorten  → updateEntity with new geometry
 *   - split    → remove original + add replacements (already carry IDs)
 *   - promote  → remove original + add new-type entity (same ID or new)
 *   - delete   → remove original
 *
 * Undo restores every snapshot in reverse order, recreating removed
 * entities verbatim.
 *
 * Audit (Q11): one entry per command via IDxfTextAuditRecorder.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md §Command Registration
 */

import { generateEntityId } from '@/services/enterprise-id.service';
import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { noopAuditRecorder, type IDxfTextAuditRecorder } from '../text/types';
import type { TrimOperation } from '../../../systems/trim/trim-types';
import type { Entity } from '../../../types/entities';

export interface TrimCommandParams {
  readonly operations: ReadonlyArray<TrimOperation>;
  readonly pickPoint: { x: number; y: number };
  /** SHIFT-held pick → EXTEND inverse op (Q9). Audit-only flag. */
  readonly inverse: boolean;
}

export class TrimEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'TrimEntities';
  readonly type = 'trim-entities';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly params: TrimCommandParams,
    private readonly sceneManager: ISceneManager,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    for (const op of this.params.operations) this.applyOperation(op);
    this.wasExecuted = this.params.operations.length > 0;
    if (this.wasExecuted) this.recordAudit(this.params.inverse ? 'extend' : 'trim');
  }

  undo(): void {
    if (!this.wasExecuted) return;
    // Reverse order to restore consistent state across split→promote sequences.
    for (let i = this.params.operations.length - 1; i >= 0; i--) {
      this.revertOperation(this.params.operations[i]);
    }
    this.recordAudit(this.params.inverse ? 'extend-undo' : 'trim-undo');
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    const verb = this.params.inverse ? 'Extend' : 'Trim';
    const n = this.params.operations.length;
    return `${verb} ${n} ${n === 1 ? 'operation' : 'operations'}`;
  }

  getAffectedEntityIds(): string[] {
    const ids = new Set<string>();
    for (const op of this.params.operations) {
      ids.add(op.entityId);
      if (op.kind === 'split') for (const r of op.replacements) ids.add(r.id);
      if (op.kind === 'promote') ids.add(op.newGeom.id);
    }
    return [...ids];
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
        inverse: this.params.inverse,
      },
      version: 1,
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private applyOperation(op: TrimOperation): void {
    switch (op.kind) {
      case 'shorten': {
        const updates = this.geometryUpdates(op.newGeom);
        this.sceneManager.updateEntity(op.entityId, updates);
        return;
      }
      case 'split': {
        this.sceneManager.removeEntity(op.entityId);
        for (const replacement of op.replacements) {
          this.sceneManager.addEntity(replacement as unknown as SceneEntity);
        }
        return;
      }
      case 'promote': {
        // Same-ID promotion (CIRCLE→ARC, ELLIPSE→ELLIPTICAL ARC) — remove + re-add.
        this.sceneManager.removeEntity(op.entityId);
        this.sceneManager.addEntity(op.newGeom as unknown as SceneEntity);
        return;
      }
      case 'delete': {
        this.sceneManager.removeEntity(op.entityId);
        return;
      }
    }
  }

  private revertOperation(op: TrimOperation): void {
    switch (op.kind) {
      case 'shorten': {
        const updates = this.geometryUpdates(op.originalGeom);
        this.sceneManager.updateEntity(op.entityId, updates);
        return;
      }
      case 'split': {
        for (const replacement of op.replacements) {
          this.sceneManager.removeEntity(replacement.id);
        }
        this.sceneManager.addEntity(op.originalGeom as unknown as SceneEntity);
        return;
      }
      case 'promote': {
        this.sceneManager.removeEntity(op.newGeom.id);
        this.sceneManager.addEntity(op.originalGeom as unknown as SceneEntity);
        return;
      }
      case 'delete': {
        this.sceneManager.addEntity(op.originalGeom as unknown as SceneEntity);
        return;
      }
    }
  }

  /** Strip identity/visibility fields — only geometric updates flow through updateEntity. */
  private geometryUpdates(entity: Readonly<Entity>): Partial<SceneEntity> {
    const { id: _id, type: _type, layer: _layer, visible: _v, ...rest } = entity as unknown as SceneEntity & Record<string, unknown>;
    return rest as Partial<SceneEntity>;
  }

  private recordAudit(op: 'trim' | 'extend' | 'trim-undo' | 'extend-undo'): void {
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
