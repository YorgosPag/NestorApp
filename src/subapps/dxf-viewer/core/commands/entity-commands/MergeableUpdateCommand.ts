/**
 * MERGEABLE UPDATE COMMAND — abstract base (SSoT) for `Update<X>ParamsCommand`.
 *
 * Eliminates the copy-pasted merge/undo/redo/canMergeWith/mergeWith skeleton that
 * every parametric `Update*ParamsCommand` repeated verbatim. A migrated subclass
 * declares ONLY what genuinely varies:
 *   - `name` / `type`            — identity (unique `type` drives canMergeWith)
 *   - `applyPatch(patch)`        — the geometry recompute + scene write
 *   - `withMergedPatch(next)`    — 1-liner factory (`new Self(...)`) for merge
 *   - `validate()` / `getDescription()`
 *   - `serializedData()`         — OPTIONAL override to keep a legacy `data` key
 *                                  shape byte-for-byte (finishId vs roofId, …)
 *
 * Behaviour is identical to the hand-written commands it replaces:
 *   - execute → applyPatch(patch) + mark executed
 *   - undo    → guard executed → applyPatch(previousPatch)
 *   - redo    → applyPatch(patch)
 *   - canMergeWith → same `type` + same entity + both dragging + within the
 *                    canonical merge window (`isWithinMergeWindow`, SSoT)
 *   - mergeWith → keep earliest `previousPatch`, adopt the latest `patch`
 *
 * `canMergeWith` uses **type-equality** (`other.type === this.type`) instead of
 * `instanceof <ConcreteSubclass>`. Since every subclass owns a unique `type`
 * string this is equivalent, and it lets the check live on the generic base
 * (an `instanceof MergeableUpdateCommand` guard alone would wrongly merge two
 * *different* subclasses on the same entity).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §8
 * @see core/commands/entity-commands/UpdateFloorFinishParamsCommand.ts — recompute reference
 * @see core/commands/entity-commands/UpdateHatchBoundaryCommand.ts — flat-primitive reference
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { isWithinMergeWindow } from '../merge-window';
// ADR-540 — universal associative reconcile. A params edit on a host (column/beam/foundation/
// wall) re-derives its scene-derived dependents (openings → wall, beams → column faces) so their
// grips never go stale. The transform family already reconciles; this base closes the gap for the
// params family (the root of the «handles stale after promote / param edit» bug). Idempotent +
// command-time (ΟΧΙ reactive) → μηδέν churn, μηδέν freeze (ADR-492 §4).
import { reconcileAssociativeGeometry } from '../../../bim/cascade/associative-geometry-reconcile';

export abstract class MergeableUpdateCommand<TPatch> implements ICommand {
  readonly id: string;
  readonly timestamp: number;

  /** Human-readable command name — declared by each subclass. */
  abstract readonly name: string;
  /** Unique type identifier — declared by each subclass; drives canMergeWith. */
  abstract readonly type: string;

  private wasExecuted = false;

  constructor(
    protected readonly entityId: string,
    protected readonly patch: TPatch,
    protected readonly previousPatch: TPatch,
    protected readonly sceneManager: ISceneManager,
    protected readonly isDragging: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  // --------------------------------------------------------------------------
  // Subclass contract
  // --------------------------------------------------------------------------

  /**
   * Apply `patch` to the scene — recompute derived geometry/validation here if
   * the entity has any. Called with the forward patch (execute/redo) and the
   * previous patch (undo); it MUST be symmetric.
   */
  protected abstract applyPatch(patch: TPatch): void;

  /**
   * Factory for the merged command. Keep `this.previousPatch` (earliest state)
   * and adopt `nextPatch` (latest drag sample). Thread any extra constructor
   * fields the subclass owns.
   */
  protected abstract withMergedPatch(nextPatch: TPatch): MergeableUpdateCommand<TPatch>;

  abstract getDescription(): string;
  abstract validate(): string | null;

  /**
   * `data` payload for `serialize()`. Default = the canonical shape. A subclass
   * with genuine extra state (e.g. Roof `typeChange`, Wall `kind`) overrides this
   * and **spreads `baseSerializedData()`** so the four canonical fields are never
   * re-spelled — one SSoT serialize shape, special cases only add their delta.
   */
  protected serializedData(): Record<string, unknown> {
    return this.baseSerializedData();
  }

  /** Canonical serialized payload (SSoT) — spread in a subclass override to add extra state. */
  protected baseSerializedData(): Record<string, unknown> {
    return {
      entityId: this.entityId,
      patch: this.patch,
      previousPatch: this.previousPatch,
      isDragging: this.isDragging,
    };
  }

  // --------------------------------------------------------------------------
  // Shared skeleton (identical for every subclass — the eliminated boilerplate)
  // --------------------------------------------------------------------------

  execute(): void {
    this.applyPatch(this.patch);
    this.wasExecuted = true;
    // ADR-540 — re-derive scene-derived dependents against the now-patched host.
    reconcileAssociativeGeometry([this.entityId], this.sceneManager);
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.applyPatch(this.previousPatch);
    // ADR-540 — re-derive dependents against the restored host (idempotent → previous geometry).
    reconcileAssociativeGeometry([this.entityId], this.sceneManager);
  }

  redo(): void {
    this.applyPatch(this.patch);
    // ADR-540 — re-derive dependents against the re-patched host.
    reconcileAssociativeGeometry([this.entityId], this.sceneManager);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof MergeableUpdateCommand)) return false;
    if (other.type !== this.type || other.entityId !== this.entityId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return isWithinMergeWindow(this, other);
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as MergeableUpdateCommand<TPatch>;
    return this.withMergedPatch(o.patch);
  }

  getAffectedEntityIds(): string[] {
    return [this.entityId];
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
}
