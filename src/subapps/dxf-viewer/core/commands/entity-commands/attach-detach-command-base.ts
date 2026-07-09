/**
 * ADR-610 — AttachDetachCommandBase SSoT (Template Method).
 *
 * The 9 structural attach/detach commands (`Attach{Columns,ColumnFooting,Stairs,
 * WallsBase,WallsTop}Command` · `Detach{Columns,ColumnFooting,Stairs,Walls}Command`)
 * repeated the SAME ~40-line `ICommand` plumbing verbatim — `id`/`timestamp`, the
 * lazy-built `patches` + `wasExecuted`, the identical execute/undo/redo triple
 * (build-once → apply next|prev per patch → post-apply hook → persist signal), the
 * `signalPersist` broadcast, `canMergeWith`, and the `serialize` envelope. This base
 * class owns that invariant; each command now supplies ΜΟΝΟ its variance:
 *   - the `name` / `type` discriminants,
 *   - `buildPatches()` — the domain+direction snapshot ({prev, next} params),
 *   - `applyEntityPatch()` — the domain geometry+validation recompute (one call into
 *     `attach-detach-entity-recompute.ts`),
 *   - `postApply()` — a no-op by default; walls override it with the hosted-opening
 *     cascade (ADR-363 §5.4),
 *   - `getDescription` / `getAffectedEntityIds` / `validate` / `serializedData`.
 *
 * Constructors stay per-command (each keeps its exact `new XCommand(...)` public API);
 * only the shared plumbing is centralized. Mirrors the batch-create SSoT
 * `createBatchEntitiesCommand` (ADR-607) — same command bucket, Template-Method form
 * because the attach/detach constructors diverge (footingId+ids · side+hostId+targets).
 *
 * @see ./attach-detach-entity-recompute.ts — the per-domain recompute helpers
 * @see ./attach-persist-signal.ts — the `bim:entities-attached` persist SSoT (ADR-401)
 * @see docs/centralized-systems/reference/adrs/ADR-610-attach-detach-command-ssot.md
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { signalEntitiesAttached } from './attach-persist-signal';

/** One entity's before/after params snapshot — the unit of an attach/detach batch. */
export interface AttachDetachPatch<TParams> {
  readonly entityId: string;
  readonly prev: TParams;
  readonly next: TParams;
}

/**
 * Shared `ICommand` plumbing for the batch attach/detach binding commands. `TPatch`
 * defaults to the bare `{entityId, prev, next}` shape; walls widen it with `kind` for
 * the geometry recompute.
 */
export abstract class AttachDetachCommandBase<
  TParams,
  TPatch extends AttachDetachPatch<TParams> = AttachDetachPatch<TParams>,
> implements ICommand {
  readonly id: string;
  abstract readonly name: string;
  abstract readonly type: string;
  readonly timestamp: number;

  /** Built once on first execute() from the live scene; reused by undo/redo. */
  protected patches: TPatch[] = [];
  private wasExecuted = false;

  protected constructor(protected readonly sceneManager: ISceneManager) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.patches.length === 0) this.patches = this.buildPatches();
    for (const p of this.patches) this.applyEntityPatch(p, p.next);
    this.wasExecuted = this.patches.length > 0;
    this.postApply();
    this.signalPersist();
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const p of this.patches) this.applyEntityPatch(p, p.prev);
    this.postApply();
    this.signalPersist();
  }

  redo(): void {
    for (const p of this.patches) this.applyEntityPatch(p, p.next);
    this.postApply();
    this.signalPersist();
  }

  /** ADR-401 — broadcast the patched entities so the persistence layer saves them. */
  protected signalPersist(): void {
    signalEntitiesAttached(this.sceneManager, this.patches.map((p) => p.entityId));
  }

  /** Post-apply cascade hook. Default no-op; walls override → hosted-opening cascade. */
  protected postApply(): void {}

  canMergeWith(): boolean {
    return false;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: this.serializedData(),
      version: 1,
    };
  }

  /** Snapshot live params per target → the {prev, next} patches (domain + direction). */
  protected abstract buildPatches(): TPatch[];
  /** Recompute geometry+validation and write the entity for one patch (domain-specific). */
  protected abstract applyEntityPatch(patch: TPatch, params: TParams): void;
  /** The command-specific `serialize().data` payload. */
  protected abstract serializedData(): SerializedCommand['data'];

  abstract getDescription(): string;
  abstract getAffectedEntityIds(): string[];
  abstract validate(): string | null;
}
