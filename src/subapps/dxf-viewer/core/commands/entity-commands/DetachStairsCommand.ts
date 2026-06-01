/**
 * DETACH STAIRS COMMAND — ADR-401 Phase G.3 (manual detach UX).
 *
 * Batch, undoable «Detach Top/Base» for N stairs — the inverse of
 * `AttachStairsCommand`. Restores the stair's side binding to its stair-honest
 * default (`unconnected` for top / `storey-floor` for base) and clears the host
 * list (`attachTopToIds` / `attachBaseToIds`) via the shared `detachStairSide`
 * SSoT, then recomputes `geometry` + `validation` atomically. One command = ONE
 * undo entry (Revit «Detach Top/Base»).
 *
 * Single generic command (`side: 'top' | 'base'`), mirror of `DetachColumnsCommand`.
 * Stairs do NOT host openings → no opening-cascade. Per-stair snapshots are built
 * ONCE on first `execute()`, so `undo()`/`redo()` are pure re-applies.
 *
 * @see core/commands/entity-commands/AttachStairsCommand.ts — the attach twin
 * @see core/commands/entity-commands/DetachColumnsCommand.ts — the column mirror
 * @see bim/stairs/stair-attach-detach.ts — detachStairSide SSoT (stair defaults)
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { StairGeometry, StairKind, StairParams } from '../../../bim/types/stair-types';
import { computeStairGeometry } from '../../../bim/geometry/stairs/StairGeometryService';
import { validateStairParams } from '../../../bim/stairs/stair-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { detachStairSide } from '../../../bim/stairs/stair-attach-detach';
import type { EntityAttachSide } from '../../../bim/entities/entity-attach-detach';

export type StairDetachSide = EntityAttachSide;

/** A stair to detach + its `kind` (carried for target-build parity with column). */
export interface StairDetachTarget {
  readonly stairId: string;
  readonly kind: StairKind;
}

interface StairDetachPatch {
  readonly stairId: string;
  readonly prev: StairParams;
  readonly next: StairParams;
}

export class DetachStairsCommand implements ICommand {
  readonly id: string;
  readonly name = 'DetachStairs';
  readonly type = 'detach-stairs';
  readonly timestamp: number;

  private patches: StairDetachPatch[] = [];
  private wasExecuted = false;

  constructor(
    private readonly side: StairDetachSide,
    private readonly targets: readonly StairDetachTarget[],
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.patches.length === 0) this.buildPatches();
    for (const p of this.patches) this.applyPatch(p.stairId, p.next);
    this.wasExecuted = this.patches.length > 0;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const p of this.patches) this.applyPatch(p.stairId, p.prev);
  }

  redo(): void {
    for (const p of this.patches) this.applyPatch(p.stairId, p.next);
  }

  /** Snapshot live params per target → {prev, next} (binding reset + ids cleared). */
  private buildPatches(): void {
    for (const { stairId } of this.targets) {
      const entity = this.sceneManager.getEntity(stairId) as unknown as { params?: StairParams } | undefined;
      const prev = entity?.params;
      if (!prev) continue;
      this.patches.push({ stairId, prev, next: detachStairSide(prev, this.side) });
    }
  }

  private applyPatch(stairId: string, params: StairParams): void {
    const geometry: StairGeometry = computeStairGeometry(params);
    const validation = validateStairParams(params);
    this.sceneManager.updateEntity(stairId, {
      params,
      geometry,
      validation,
    } as unknown as Record<string, unknown>);
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Detach ${this.targets.length} stair(s) ${this.side}`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.stairId);
  }

  validate(): string | null {
    if (this.targets.length === 0) return 'At least one stair target is required';
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
