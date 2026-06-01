/**
 * DETACH COLUMNS COMMAND — ADR-401 Phase F.3 (manual detach UX).
 *
 * Batch, undoable «Detach Top/Base» for N columns — the inverse of
 * `AttachColumnsCommand`. Restores the column's side binding to its default
 * (`storey-ceiling` for top / `storey-floor` for base) and clears the host list
 * (`attachTopToIds` / `attachBaseToIds`) via the shared `detachEntitySide` SSoT,
 * then recomputes `geometry` + `validation` atomically. One command = ONE undo
 * entry (Revit «Detach Top/Base»).
 *
 * Single generic command (`side: 'top' | 'base'`), mirror of `DetachWallsCommand`.
 * Columns do NOT host openings → no opening-cascade. Per-column snapshots are
 * built ONCE on first `execute()`, so `undo()`/`redo()` are pure re-applies.
 *
 * @see core/commands/entity-commands/AttachColumnsCommand.ts — the attach twin
 * @see core/commands/entity-commands/DetachWallsCommand.ts — the wall mirror
 * @see bim/entities/entity-attach-detach.ts — detachEntitySide SSoT
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { ColumnGeometry, ColumnKind, ColumnParams } from '../../../bim/types/column-types';
import { computeColumnGeometry } from '../../../bim/geometry/column-geometry';
import { validateColumnParams } from '../../../bim/validators/column-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { detachEntitySide, type EntityAttachSide } from '../../../bim/entities/entity-attach-detach';
// ADR-401 — persist the binding change (detach-on-host-delete targets non-selected columns).
import { signalEntitiesAttached } from './attach-persist-signal';

export type ColumnDetachSide = EntityAttachSide;

/** A column to detach + its `kind` (kept in sync on the entity root). */
export interface ColumnDetachTarget {
  readonly columnId: string;
  readonly kind: ColumnKind;
}

interface ColumnDetachPatch {
  readonly columnId: string;
  readonly kind: ColumnKind;
  readonly prev: ColumnParams;
  readonly next: ColumnParams;
}

export class DetachColumnsCommand implements ICommand {
  readonly id: string;
  readonly name = 'DetachColumns';
  readonly type = 'detach-columns';
  readonly timestamp: number;

  private patches: ColumnDetachPatch[] = [];
  private wasExecuted = false;

  constructor(
    private readonly side: ColumnDetachSide,
    private readonly targets: readonly ColumnDetachTarget[],
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.patches.length === 0) this.buildPatches();
    for (const p of this.patches) this.applyPatch(p.columnId, p.next);
    this.wasExecuted = this.patches.length > 0;
    this.signalPersist();
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const p of this.patches) this.applyPatch(p.columnId, p.prev);
    this.signalPersist();
  }

  redo(): void {
    for (const p of this.patches) this.applyPatch(p.columnId, p.next);
    this.signalPersist();
  }

  /** Snapshot live params per target → {prev, next} (binding reset + ids cleared). */
  private buildPatches(): void {
    for (const { columnId, kind } of this.targets) {
      const entity = this.sceneManager.getEntity(columnId) as unknown as { params?: ColumnParams } | undefined;
      const prev = entity?.params;
      if (!prev) continue;
      this.patches.push({ columnId, kind, prev, next: detachEntitySide(prev, this.side) });
    }
  }

  private applyPatch(columnId: string, params: ColumnParams): void {
    const geometry: ColumnGeometry = computeColumnGeometry(params);
    const validation = validateColumnParams(params).bimValidation;
    this.sceneManager.updateEntity(columnId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  /** ADR-401 — broadcast the patched columns so the persistence layer saves them. */
  private signalPersist(): void {
    signalEntitiesAttached(this.sceneManager, this.patches.map((p) => p.columnId));
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Detach ${this.targets.length} column(s) ${this.side}`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.columnId);
  }

  validate(): string | null {
    if (this.targets.length === 0) return 'At least one column target is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        side: this.side,
        targets: this.targets,
      },
      version: 1,
    };
  }
}
