/**
 * ADR-610 — per-domain intermediate base classes for the attach/detach batch commands.
 *
 * Sit between the generic `AttachDetachCommandBase` (ICommand plumbing + `snapshotPatches`)
 * and the concrete `Attach/Detach<Domain>Command`s. Each binds the domain's
 * `applyEntityPatch` (the geometry+validation recompute) + a thin `build*Patches`
 * wrapper over `snapshotPatches`, so a concrete command supplies ΜΟΝΟ its binding
 * mutation + metadata. Walls also bind the hosted-opening `postApply` cascade + the
 * `kind`-carrying patch shape.
 *
 * This is what keeps the concrete cells clone-free (the recompute/cascade/loop bodies
 * were the structural twins jscpd flagged, ADR-584 / N.18).
 *
 * @see ./attach-detach-command-base.ts — the generic Template-Method base
 * @see ./attach-detach-entity-recompute.ts — the recompute helpers bound here
 */

import type { ISceneManager, SerializedCommand } from '../interfaces';
import type { ColumnParams } from '../../../bim/types/column-types';
import type { StairParams } from '../../../bim/types/stair-types';
import type { WallKind, WallParams } from '../../../bim/types/wall-types';
import { attachEntitySide, type EntityAttachSide } from '../../../bim/entities/entity-attach-detach';
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';
import { AttachDetachCommandBase, type AttachDetachPatch } from './attach-detach-command-base';
import {
  recomputeColumnEntity,
  recomputeStairEntity,
  recomputeWallEntity,
  type WallAttachDetachPatch,
} from './attach-detach-entity-recompute';

/** Column attach/detach base — binds the column recompute + a bare-patch snapshot. */
export abstract class ColumnAttachDetachCommand extends AttachDetachCommandBase<ColumnParams> {
  protected applyEntityPatch(patch: AttachDetachPatch<ColumnParams>, params: ColumnParams): void {
    recomputeColumnEntity(this.sceneManager, patch.entityId, params);
  }

  protected buildColumnPatches<TEntry>(
    entries: readonly TEntry[],
    entityIdOf: (entry: TEntry) => string,
    computeNext: (prev: ColumnParams) => ColumnParams | null,
  ): AttachDetachPatch<ColumnParams>[] {
    return this.snapshotPatches(entries, entityIdOf, (prev) => computeNext(prev), (entityId, prev, next) => ({
      entityId,
      prev,
      next,
    }));
  }
}

/**
 * The `footingId` FK connectivity commands share their `columnIds` iteration
 * (`AttachColumnFootingCommand` / `DetachColumnFootingCommand`). This base owns the id
 * list + the snapshot wrapper; each cell supplies ΜΟΝΟ its FK mutation + metadata.
 */
export abstract class ColumnFootingFkCommand extends ColumnAttachDetachCommand {
  constructor(
    protected readonly columnIds: readonly string[],
    sceneManager: ISceneManager,
  ) {
    super(sceneManager);
  }

  protected footingPatches(
    computeNext: (prev: ColumnParams) => ColumnParams | null,
  ): AttachDetachPatch<ColumnParams>[] {
    return this.buildColumnPatches(this.columnIds, (id) => id, computeNext);
  }

  getAffectedEntityIds(): string[] {
    return [...this.columnIds];
  }
}

/** Stair attach/detach base — binds the stair recompute + a bare-patch snapshot. */
export abstract class StairAttachDetachCommand extends AttachDetachCommandBase<StairParams> {
  protected applyEntityPatch(patch: AttachDetachPatch<StairParams>, params: StairParams): void {
    recomputeStairEntity(this.sceneManager, patch.entityId, params);
  }

  protected buildStairPatches<TEntry>(
    entries: readonly TEntry[],
    entityIdOf: (entry: TEntry) => string,
    computeNext: (prev: StairParams) => StairParams | null,
  ): AttachDetachPatch<StairParams>[] {
    return this.snapshotPatches(entries, entityIdOf, (prev) => computeNext(prev), (entityId, prev, next) => ({
      entityId,
      prev,
      next,
    }));
  }
}

/**
 * Wall attach/detach base — binds the wall recompute (needs `kind`), the hosted-opening
 * cascade (`postApply`), and the `kind`-carrying patch shape.
 */
export abstract class WallAttachDetachCommand extends AttachDetachCommandBase<WallParams, WallAttachDetachPatch> {
  protected applyEntityPatch(patch: WallAttachDetachPatch, params: WallParams): void {
    recomputeWallEntity(this.sceneManager, patch.entityId, params, patch.kind);
  }

  protected override postApply(): void {
    if (this.patches.length === 0) return;
    cascadeHostedOpeningsForWalls(this.patches.map((p) => p.entityId), this.sceneManager);
  }

  protected buildWallPatches<TEntry extends { readonly kind: WallKind }>(
    entries: readonly TEntry[],
    entityIdOf: (entry: TEntry) => string,
    computeNext: (prev: WallParams) => WallParams | null,
  ): WallAttachDetachPatch[] {
    return this.snapshotPatches(entries, entityIdOf, (prev) => computeNext(prev), (entityId, prev, next, entry) => ({
      entityId,
      kind: entry.kind,
      prev,
      next,
    }));
  }
}

/** A wall to attach + its `kind` (needed for the geometry recompute). Shared by the two
 * fixed-side `AttachWalls{Base,Top}Command` cells. */
export interface WallAttachTarget {
  readonly wallId: string;
  readonly kind: WallKind;
}

/**
 * «Attach {top|base} to host» wall command — the shared shape of `AttachWallsTopCommand`
 * / `AttachWallsBaseCommand` (identical but for the fixed `side`). Concrete cells supply
 * ΜΟΝΟ their `name` / `type` / `side`.
 */
export abstract class WallHostAttachCommand extends WallAttachDetachCommand {
  protected abstract readonly side: EntityAttachSide;

  constructor(
    protected readonly hostId: string,
    protected readonly targets: readonly WallAttachTarget[],
    sceneManager: ISceneManager,
  ) {
    super(sceneManager);
  }

  protected buildPatches(): WallAttachDetachPatch[] {
    return this.buildWallPatches(this.targets, (t) => t.wallId, (prev) =>
      attachEntitySide(prev, this.side, this.hostId),
    );
  }

  getDescription(): string {
    return `Attach ${this.targets.length} wall(s) ${this.side} to host`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.wallId);
  }

  validate(): string | null {
    if (!this.hostId) return 'Host entity ID is required';
    if (this.targets.length === 0) return 'At least one wall target is required';
    return null;
  }

  protected serializedData(): SerializedCommand['data'] {
    return { hostId: this.hostId, targets: this.targets };
  }
}
