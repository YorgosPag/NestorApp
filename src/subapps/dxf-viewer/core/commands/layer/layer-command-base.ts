/**
 * @module core/commands/layer/layer-command-base
 * @description Template-Method bases for the DXF layer command family (ADR-616).
 *
 * The 12 layer commands under `core/commands/layer/` each repeated the same
 * `ICommand` boilerplate — `id = makeLayerCommandKey(prefix)` + `timestamp`
 * init, the six-field `serialize()` envelope, `getAffectedEntityIds() → []` —
 * plus one of four near-identical lifecycles. This module collapses all of it
 * onto the generic **`BaseCommand`** (ADR-613) plus four layer Template-Method
 * bases, in the spirit of the AutoCAD/Revit command architecture (one root,
 * thin per-operation leaves). Snapshot/restore stays in `layer-command-utils`.
 *
 * Layering:
 *   BaseCommand (ADR-613, generic; `id` injected)
 *     └─ LayerCommandBase            (id via makeLayerCommandKey + affected-ids default)
 *          ├─ SingleLayerFlagCommand (Freeze / Lock / Off — flag toggle + snapshot + no-op)
 *          ├─ MutateAllLayersCommand (OnAll / ThawAll — mutate-all + restore + replay)
 *          ├─ IsolateEffectsCommand  (Category / Entity isolate — effects snapshot/apply/restore)
 *          └─ DelegatingLayerCommand (Dim / IsolateInverse — wrap a LayerIsolateCommand)
 *
 * @see ADR-616 (Layer command SSoT)
 * @see ./layer-command-utils.ts (snapshot capture/restore — ADR-358 §5.6.bis)
 * @since 2026-07-09
 */

import type { ICommand } from '../interfaces';
import { BaseCommand } from '../base-command';
import { getLayer, upsertLayer, getAllLayers } from '../../../stores/LayerStore';
import {
  clearIsolateEffects,
  getIsolateEffectsSnapshot,
  setIsolateEffects,
  type IsolateEffectsSnapshot,
} from '../../../systems/isolate/IsolateEffectsStore';
import {
  captureLayerSnapshot,
  makeLayerCommandKey,
  mutateAllLayersFlag,
  restoreLayerEntry,
  restoreLayersSnapshot,
  type UnisolateSnapshotEntry,
} from './layer-command-utils';

/**
 * Root for every layer command. Mints the `lyr-cmd` history key via
 * `makeLayerCommandKey` (preserving the exact legacy id format) and defaults
 * `getAffectedEntityIds()` to `[]` — layer commands act on layers, not
 * entities (EntityIsolate overrides). Subclasses supply `name`/`type`,
 * `execute`/`undo`/`redo`/`getDescription` and the serialized payload.
 */
export abstract class LayerCommandBase extends BaseCommand {
  protected wasExecuted = false;

  constructor(typePrefix: string) {
    super(makeLayerCommandKey(typePrefix));
  }

  getAffectedEntityIds(): string[] {
    return [];
  }
}

/** Single-layer input carried by the flag-toggle commands. */
export interface SingleLayerInput {
  layerId: string;
}

/**
 * Freeze / Lock / Off — set one boolean flag on a single layer. Idempotent:
 * a no-op (and no snapshot) when the layer is already at the target value or
 * missing. `undo()` restores the captured pre-state; `redo()` re-applies.
 * Subclass declares only `flag` + `targetValue` (+ `name`/`type`/description).
 */
export abstract class SingleLayerFlagCommand extends LayerCommandBase {
  protected preState: UnisolateSnapshotEntry | null = null;
  protected wasNoOp = false;

  /** The SceneLayer boolean flag this command drives. */
  protected abstract readonly flag: 'frozen' | 'locked' | 'visible';
  /** The value written to {@link flag} on execute. */
  protected abstract readonly targetValue: boolean;

  constructor(typePrefix: string, protected readonly input: SingleLayerInput) {
    super(typePrefix);
  }

  execute(): void {
    if (!this.wasExecuted) {
      const layer = getLayer(this.input.layerId);
      if (!layer || layer[this.flag] === this.targetValue) {
        this.wasNoOp = true;
        this.wasExecuted = true;
        return;
      }
      this.preState = captureLayerSnapshot(this.input.layerId);
      this.wasExecuted = true;
    }
    if (this.wasNoOp) return;
    this.applyFlag();
  }

  undo(): void {
    if (this.wasNoOp || !this.preState) return;
    restoreLayerEntry(this.preState);
  }

  redo(): void {
    if (this.wasNoOp) return;
    this.applyFlag();
  }

  protected serializeData(): Record<string, unknown> {
    return { layerId: this.input.layerId };
  }

  private applyFlag(): void {
    const layer = getLayer(this.input.layerId);
    if (!layer) return;
    upsertLayer({ ...layer, [this.flag]: this.targetValue });
  }
}

/**
 * OnAll / ThawAll — flip one flag to a target value on every non-matching
 * layer. `execute()` captures the mutated layers on first run (reused on
 * `redo()`); `undo()` restores them. Subclass declares only `flag` +
 * `targetValue` (+ `name`/`type`/description).
 */
export abstract class MutateAllLayersCommand extends LayerCommandBase {
  protected mutatedSnapshot: ReadonlyArray<UnisolateSnapshotEntry> | null = null;

  protected abstract readonly flag: 'frozen' | 'visible';
  protected abstract readonly targetValue: boolean;

  execute(): void {
    if (!this.wasExecuted) {
      this.mutatedSnapshot = mutateAllLayersFlag(this.flag, this.targetValue);
      this.wasExecuted = true;
      return;
    }
    this.replayExecute();
  }

  undo(): void {
    if (!this.mutatedSnapshot) return;
    restoreLayersSnapshot(this.mutatedSnapshot);
  }

  redo(): void {
    this.replayExecute();
  }

  protected serializeData(): Record<string, unknown> {
    return {};
  }

  private replayExecute(): void {
    for (const layer of getAllLayers()) {
      const current = this.flag === 'frozen' ? (layer.frozen ?? false) : layer.visible;
      if (current === this.targetValue) continue;
      upsertLayer({ ...layer, [this.flag]: this.targetValue });
    }
  }
}

/**
 * Category / Entity isolate — session-only visibility gating via
 * `IsolateEffectsStore` (no layer-flag mutation). `execute()` snapshots the
 * live effects then applies; `undo()` restores the previous session (or
 * clears); `redo()` re-applies. Subclass implements only `applyEffects()`
 * (+ `name`/`type`/description/payload, and `getAffectedEntityIds` if scoped).
 */
export abstract class IsolateEffectsCommand<I> extends LayerCommandBase {
  protected effectsBeforeExecute: IsolateEffectsSnapshot | null = null;

  constructor(typePrefix: string, protected readonly input: I) {
    super(typePrefix);
  }

  execute(): void {
    if (!this.wasExecuted) {
      this.effectsBeforeExecute = getIsolateEffectsSnapshot();
      this.wasExecuted = true;
    }
    this.applyEffects();
  }

  undo(): void {
    const prev = this.effectsBeforeExecute;
    if (prev && prev.active) {
      setIsolateEffects({
        mode: prev.mode,
        isolatedLayerIds: prev.isolatedLayerIds,
        isolatedEntityIds: prev.isolatedEntityIds,
        isolatedCategories: prev.isolatedCategories,
        dimOpacityPercent: prev.dimOpacityPercent,
        category: prev.category,
      });
      return;
    }
    clearIsolateEffects();
  }

  redo(): void {
    this.applyEffects();
  }

  /** Push this command's isolate effect into the store (session-only). */
  protected abstract applyEffects(): void;
}

/**
 * Dim / IsolateInverse — thin wrappers that construct a one-shot
 * `LayerIsolateCommand` at build time and delegate the whole lifecycle to it.
 * `inner` is typed as `ICommand` to avoid a cycle with `LayerIsolateCommand`
 * (which itself extends `LayerCommandBase`). Subclass builds `inner` in its
 * ctor and supplies `name`/`type`/description/payload.
 */
export abstract class DelegatingLayerCommand extends LayerCommandBase {
  protected constructor(typePrefix: string, protected readonly inner: ICommand) {
    super(typePrefix);
  }

  execute(): void {
    this.inner.execute();
  }

  undo(): void {
    this.inner.undo();
  }

  redo(): void {
    this.inner.redo();
  }
}
