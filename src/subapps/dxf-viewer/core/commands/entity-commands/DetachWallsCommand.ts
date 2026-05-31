/**
 * DETACH WALLS COMMAND — ADR-401 Phase E.1 (manual detach UX).
 *
 * Batch, undoable «Detach Top/Base» for N walls — the inverse of
 * `AttachWalls{Top|Base}Command`. Restores the wall's binding to its default
 * (`storey-ceiling` for top / `storey-floor` for base) and clears the host
 * list (`attachTopToIds` / `attachBaseToIds`), then recomputes `geometry` +
 * `validation` and cascades hosted openings — atomically. One command = ONE
 * undo entry (Revit «Detach Top/Base»).
 *
 * Single generic command (`side: 'top' | 'base'`) instead of two mirror files
 * (the only difference is which binding/ids field is reset) — pure SSoT.
 *
 * Per-wall snapshots (prev/next params) are built ONCE on first `execute()` from
 * the live scene, so `undo()`/`redo()` are pure re-applies (idempotent).
 *
 * @see core/commands/entity-commands/AttachWallsBaseCommand.ts — the attach twin
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.5
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { WallGeometry, WallKind, WallParams } from '../../../bim/types/wall-types';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../../bim/validators/wall-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';
import {
  DEFAULT_WALL_TOP_BINDING,
  DEFAULT_WALL_BASE_BINDING,
} from '../../../bim/types/bim-binding';

export type WallDetachSide = 'top' | 'base';

/** A wall to detach + its `kind` (needed for the geometry recompute). */
export interface WallDetachTarget {
  readonly wallId: string;
  readonly kind: WallKind;
}

interface WallDetachPatch {
  readonly wallId: string;
  readonly kind: WallKind;
  readonly prev: WallParams;
  readonly next: WallParams;
}

/** Reset the side-specific binding + clear its host list. */
function buildDetachedParams(prev: WallParams, side: WallDetachSide): WallParams {
  return side === 'top'
    ? { ...prev, topBinding: DEFAULT_WALL_TOP_BINDING, attachTopToIds: undefined }
    : { ...prev, baseBinding: DEFAULT_WALL_BASE_BINDING, attachBaseToIds: undefined };
}

export class DetachWallsCommand implements ICommand {
  readonly id: string;
  readonly name = 'DetachWalls';
  readonly type = 'detach-walls';
  readonly timestamp: number;

  private patches: WallDetachPatch[] = [];
  private wasExecuted = false;

  constructor(
    private readonly side: WallDetachSide,
    private readonly targets: readonly WallDetachTarget[],
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.patches.length === 0) this.buildPatches();
    for (const p of this.patches) this.applyPatch(p.wallId, p.next, p.kind);
    this.wasExecuted = this.patches.length > 0;
    this.cascade();
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const p of this.patches) this.applyPatch(p.wallId, p.prev, p.kind);
    this.cascade();
  }

  redo(): void {
    for (const p of this.patches) this.applyPatch(p.wallId, p.next, p.kind);
    this.cascade();
  }

  /** Snapshot live params per target → {prev, next} (binding reset + ids cleared). */
  private buildPatches(): void {
    for (const { wallId, kind } of this.targets) {
      const entity = this.sceneManager.getEntity(wallId) as unknown as { params?: WallParams } | undefined;
      const prev = entity?.params;
      if (!prev) continue;
      this.patches.push({ wallId, kind, prev, next: buildDetachedParams(prev, this.side) });
    }
  }

  private applyPatch(wallId: string, params: WallParams, kind: WallKind): void {
    const geometry: WallGeometry = computeWallGeometry(params, kind);
    const validation = validateWallParams(params).bimValidation;
    this.sceneManager.updateEntity(wallId, {
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  private cascade(): void {
    if (this.patches.length === 0) return;
    cascadeHostedOpeningsForWalls(this.patches.map((p) => p.wallId), this.sceneManager);
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Detach ${this.targets.length} wall(s) ${this.side}`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.wallId);
  }

  validate(): string | null {
    if (this.targets.length === 0) return 'At least one wall target is required';
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
