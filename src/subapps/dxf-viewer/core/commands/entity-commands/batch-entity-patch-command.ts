/**
 * @module core/commands/entity-commands/batch-entity-patch-command
 * @description Template-Method base (SSoT) for batch, undoable «derived-patch»
 * entity commands.
 *
 * A whole family of structural/display commands share ONE skeleton: build a
 * list of per-entity `{prev, next}` param patches **once** from the live scene,
 * then on `execute`/`redo` write every `next` and on `undo` write every `prev`.
 * The only genuine variation is (a) how the patch list is built (domain compute
 * + guards) and (b) how a single patch is written (geometry-neutral param write
 * vs full geometry recompute vs a `styleOverride` write). This base owns the
 * identical lifecycle; concrete commands supply only {@link buildPatches} and
 * {@link applyState}.
 *
 * Persistence is a flag, not a subclass level: pass `persistSignal = true` to
 * broadcast the patched ids via `signalEntitiesAttached` after every apply
 * (ADR-401 persist SSoT); leave it `false` when a later effect owns persistence
 * (e.g. geometry-mutating auto-size). Commands whose affected ids ARE their
 * input id list adopt {@link EntityIdsBatchPatchCommand}, which folds the
 * shared `entityIds` contract (affected-ids / non-empty validate / serialize).
 *
 * Adopts the generic {@link BaseCommand} root (id/timestamp/`redo`/`serialize`
 * envelope + no-merge default) — one command architecture, thin leaves, in the
 * spirit of the AutoCAD / Figma command stacks.
 *
 * @see ADR-617 (entity-command SSoT)
 * @see ../base-command.ts (BaseCommand)
 * @see ./AutoReinforceOrganismCommand.ts ./ComputeLoadPathCommand.ts — reference leaves
 * @since 2026-07-09
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import { BaseCommand } from '../base-command';
import { signalEntitiesAttached } from './attach-persist-signal';

/** One entity's forward/backward param snapshot. */
export interface BatchPatchEntry<TState> {
  readonly entityId: string;
  readonly prev: TState;
  readonly next: TState;
}

/**
 * Abstract base for a batch «apply a per-entity patch, undoable» command.
 *
 * @typeParam TState the per-entity payload written to the scene (params, style…).
 * @typeParam TEntry the patch-entry shape (defaults to {@link BatchPatchEntry}; a
 *   subclass extends it to carry extra per-entity metadata, e.g. an entity kind).
 */
export abstract class BatchEntityPatchCommand<
  TState,
  TEntry extends BatchPatchEntry<TState> = BatchPatchEntry<TState>,
> extends BaseCommand {
  /** Built once on first execute() / getter access; reused by undo/redo. */
  protected patches: TEntry[] = [];
  private wasExecuted = false;

  /**
   * @param sceneManager the scene to read/write.
   * @param persistSignal when true, `signalEntitiesAttached` broadcasts the
   *   patched ids after every apply (ADR-401). Default false.
   */
  constructor(
    protected readonly sceneManager: ISceneManager,
    private readonly persistSignal: boolean = false,
  ) {
    super();
  }

  // --------------------------------------------------------------------------
  // Subclass contract
  // --------------------------------------------------------------------------

  /**
   * Snapshot live params per entity → `{prev, next}`. Runs the domain compute
   * and every guard (skip non-matching / already-satisfied entities). Pure w.r.t.
   * the scene beyond reads — the base owns the writes.
   */
  protected abstract buildPatches(): TEntry[];

  /**
   * Write one entry's `state` to the scene. Called with `entry.next`
   * (execute/redo) and `entry.prev` (undo); it MUST be symmetric.
   */
  protected abstract applyState(entry: TEntry, state: TState): void;

  /** Post-apply hook — broadcast the patched ids when persistence is enabled. */
  protected afterApply(): void {
    if (this.persistSignal) {
      signalEntitiesAttached(this.sceneManager, this.patches.map((p) => p.entityId));
    }
  }

  // --------------------------------------------------------------------------
  // Shared lifecycle (the eliminated boilerplate)
  // --------------------------------------------------------------------------

  execute(): void {
    if (this.patches.length === 0) this.patches = this.buildPatches();
    for (const p of this.patches) this.applyState(p, p.next);
    this.wasExecuted = this.patches.length > 0;
    this.afterApply();
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const p of this.patches) this.applyState(p, p.prev);
    this.afterApply();
  }

  redo(): void {
    for (const p of this.patches) this.applyState(p, p.next);
    this.afterApply();
  }

  // --------------------------------------------------------------------------
  // Shared helpers
  // --------------------------------------------------------------------------

  /**
   * Ids that actually received a patch (builds the list lazily if needed).
   * Concrete commands expose this under their domain getter name
   * (`getReinforcedEntityIds`, `getLoadedMemberIds`, …).
   */
  protected patchedEntityIds(): string[] {
    if (this.patches.length === 0) this.patches = this.buildPatches();
    return this.patches.map((p) => p.entityId);
  }

  /**
   * Geometry-neutral param write — `{kind, params}` only. For additive inputs
   * (load takedown, reinforcement) the entity's cached geometry/validation stay
   * valid, so no recompute is needed.
   */
  protected writeParamsOnly(entityId: string, params: { readonly kind: string }): void {
    this.sceneManager.updateEntity(entityId, {
      kind: params.kind,
      params,
    } as unknown as Partial<SceneEntity>);
  }
}

/**
 * Batch patch command whose affected ids ARE its input id list. Folds the
 * shared `entityIds` contract — `getAffectedEntityIds`, the «≥1 id» validate,
 * and the canonical `{ entityIds }` serialized payload — so id-list commands
 * (auto-reinforce / auto-size / component-visibility) declare only their domain
 * `buildPatches` + `applyState`. A subclass with extra serialized state (e.g.
 * component-visibility's `component`/`value`) overrides {@link serializeData}.
 */
export abstract class EntityIdsBatchPatchCommand<
  TState,
  TEntry extends BatchPatchEntry<TState> = BatchPatchEntry<TState>,
> extends BatchEntityPatchCommand<TState, TEntry> {
  constructor(
    protected readonly entityIds: readonly string[],
    sceneManager: ISceneManager,
    persistSignal: boolean = false,
  ) {
    super(sceneManager, persistSignal);
  }

  getAffectedEntityIds(): string[] {
    return [...this.entityIds];
  }

  validate(): string | null {
    return this.entityIds.length === 0 ? 'At least one entity id is required' : null;
  }

  protected serializeData(): Record<string, unknown> {
    return { entityIds: [...this.entityIds] };
  }
}
