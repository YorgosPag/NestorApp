/**
 * ATTACH COLUMNS COMMAND — ADR-401 Phase F.3 (column auto/manual attach UX).
 *
 * Batch, undoable «Attach Top/Base to Structural» for N columns onto ONE
 * structural host (beam / slab). Sets each column's side binding to `'attached'`
 * and appends the host id to `attachTopToIds` / `attachBaseToIds`, then recomputes
 * `geometry` + `validation` atomically via `computeColumnGeometry()` +
 * `validateColumnParams()` (single recompute SSoT) — mirroring
 * `UpdateColumnParamsCommand`. One command = ONE undo entry (Revit "Attach").
 *
 * Single generic command (`side: 'top' | 'base'`) — the only difference is which
 * binding/ids field is set (mirror of `DetachWallsCommand`'s one-file pattern,
 * not the wall's two `AttachWalls{Top|Base}Command` files). Columns do NOT host
 * openings, so there is no opening-cascade (unlike the wall attach commands).
 *
 * Per-column snapshots (prev/next params) are built ONCE on first `execute()` from
 * the live scene, so `undo()`/`redo()` are pure re-applies (idempotent). The host
 * id stays on the attach list even after undo of the host deletion (ADR-401 Phase
 * C round-trip) — here we only ADD on attach.
 *
 * NOTE: beam/slab creation itself is NOT a command (direct `appendEntityToScene`),
 * so undo of this command detaches the columns while the host stays (Revit parity).
 *
 * @see core/commands/entity-commands/DetachColumnsCommand.ts — the detach twin
 * @see core/commands/entity-commands/AttachWallsTopCommand.ts — the wall mirror
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase F)
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { ColumnGeometry, ColumnKind, ColumnParams } from '../../../bim/types/column-types';
import { computeColumnGeometry } from '../../../bim/geometry/column-geometry';
import { validateColumnParams } from '../../../bim/validators/column-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import type { EntityAttachSide } from '../../../bim/entities/entity-attach-detach';
// ADR-401 — persist the binding change (auto-attach targets non-selected columns).
import { signalEntitiesAttached } from './attach-persist-signal';

export type ColumnAttachSide = EntityAttachSide;

/** A column to attach + its `kind` (kept in sync on the entity root). */
export interface ColumnAttachTarget {
  readonly columnId: string;
  readonly kind: ColumnKind;
}

interface ColumnAttachPatch {
  readonly columnId: string;
  readonly kind: ColumnKind;
  readonly prev: ColumnParams;
  readonly next: ColumnParams;
}

/** Append `hostId` to the side's host-id list (dedup) + set binding to 'attached'. */
function attachColumnSide(prev: ColumnParams, side: ColumnAttachSide, hostId: string): ColumnParams {
  if (side === 'top') {
    const ids = prev.attachTopToIds ?? [];
    const nextIds = ids.includes(hostId) ? ids : [...ids, hostId];
    return { ...prev, topBinding: 'attached', attachTopToIds: nextIds };
  }
  const ids = prev.attachBaseToIds ?? [];
  const nextIds = ids.includes(hostId) ? ids : [...ids, hostId];
  return { ...prev, baseBinding: 'attached', attachBaseToIds: nextIds };
}

export class AttachColumnsCommand implements ICommand {
  readonly id: string;
  readonly name = 'AttachColumns';
  readonly type = 'attach-columns';
  readonly timestamp: number;

  /** Built once on first execute() from live scene; reused by undo/redo. */
  private patches: ColumnAttachPatch[] = [];
  private wasExecuted = false;

  constructor(
    private readonly side: ColumnAttachSide,
    private readonly hostId: string,
    private readonly targets: readonly ColumnAttachTarget[],
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

  /** Snapshot live params per target → {prev, next} (attached + host appended). */
  private buildPatches(): void {
    for (const { columnId, kind } of this.targets) {
      const entity = this.sceneManager.getEntity(columnId) as unknown as { params?: ColumnParams } | undefined;
      const prev = entity?.params;
      if (!prev) continue;
      this.patches.push({ columnId, kind, prev, next: attachColumnSide(prev, this.side, this.hostId) });
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
    return `Attach ${this.targets.length} column(s) ${this.side} to host`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.columnId);
  }

  validate(): string | null {
    if (!this.hostId) return 'Host entity ID is required';
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
        hostId: this.hostId,
        targets: this.targets,
      },
      version: 1,
    };
  }
}
