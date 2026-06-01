/**
 * ATTACH STAIRS COMMAND — ADR-401 Phase G.3 (stair auto/manual attach UX).
 *
 * Batch, undoable «Attach Top/Base to Structural» for N stairs onto ONE structural
 * host (beam / slab / landing). Sets each stair's side binding to `'attached'` and
 * appends the host id to `attachTopToIds` / `attachBaseToIds`, then recomputes
 * `geometry` + `validation` atomically via `computeStairGeometry()` +
 * `validateStairParams()` — mirroring `UpdateStairParamsCommand`. One command =
 * ONE undo entry (Revit "Attach").
 *
 * Single generic command (`side: 'top' | 'base'`) — mirror του `AttachColumnsCommand`'s
 * one-file pattern. The stored `params` stay NOMINAL: the effective whole-step
 * re-step against the host underside happens at RENDER time in
 * `BimSceneLayer.syncStairs` (G.2 `resolveEffectiveStairParams`), exactly like the
 * column's per-corner profile is applied at render — the entity only persists the
 * binding fields. Stairs do NOT host openings → no opening-cascade.
 *
 * Per-stair snapshots (prev/next params) are built ONCE on first `execute()` from
 * the live scene, so `undo()`/`redo()` are pure re-applies (idempotent).
 *
 * NOTE: beam/slab creation itself is NOT a command (direct `appendEntityToScene`),
 * so undo of this command detaches the stairs while the host stays (Revit parity).
 *
 * @see core/commands/entity-commands/DetachStairsCommand.ts — the detach twin
 * @see core/commands/entity-commands/AttachColumnsCommand.ts — the column mirror
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase G)
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { StairGeometry, StairKind, StairParams } from '../../../bim/types/stair-types';
import { computeStairGeometry } from '../../../bim/geometry/stairs/StairGeometryService';
import { validateStairParams } from '../../../bim/stairs/stair-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import type { EntityAttachSide } from '../../../bim/entities/entity-attach-detach';

export type StairAttachSide = EntityAttachSide;

/** A stair to attach + its `kind` (carried for target-build parity with column). */
export interface StairAttachTarget {
  readonly stairId: string;
  readonly kind: StairKind;
}

interface StairAttachPatch {
  readonly stairId: string;
  readonly prev: StairParams;
  readonly next: StairParams;
}

/** Append `hostId` to the side's host-id list (dedup) + set binding to 'attached'. */
function attachStairSide(prev: StairParams, side: StairAttachSide, hostId: string): StairParams {
  if (side === 'top') {
    const ids = prev.attachTopToIds ?? [];
    const nextIds = ids.includes(hostId) ? ids : [...ids, hostId];
    return { ...prev, topBinding: 'attached', attachTopToIds: nextIds };
  }
  const ids = prev.attachBaseToIds ?? [];
  const nextIds = ids.includes(hostId) ? ids : [...ids, hostId];
  return { ...prev, baseBinding: 'attached', attachBaseToIds: nextIds };
}

export class AttachStairsCommand implements ICommand {
  readonly id: string;
  readonly name = 'AttachStairs';
  readonly type = 'attach-stairs';
  readonly timestamp: number;

  /** Built once on first execute() from live scene; reused by undo/redo. */
  private patches: StairAttachPatch[] = [];
  private wasExecuted = false;

  constructor(
    private readonly side: StairAttachSide,
    private readonly hostId: string,
    private readonly targets: readonly StairAttachTarget[],
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

  /** Snapshot live params per target → {prev, next} (attached + host appended). */
  private buildPatches(): void {
    for (const { stairId } of this.targets) {
      const entity = this.sceneManager.getEntity(stairId) as unknown as { params?: StairParams } | undefined;
      const prev = entity?.params;
      if (!prev) continue;
      this.patches.push({ stairId, prev, next: attachStairSide(prev, this.side, this.hostId) });
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
    return `Attach ${this.targets.length} stair(s) ${this.side} to host`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.stairId);
  }

  validate(): string | null {
    if (!this.hostId) return 'Host entity ID is required';
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
        hostId: this.hostId,
        targets: this.targets,
      },
      version: 1,
    };
  }
}
