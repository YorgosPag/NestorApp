/**
 * LayerIsolateCommand — ADR-358 §5.6.bis (Q10 FULL Enterprise) — Phase 10.
 *
 * Activate an isolate session: keep `targetLayerIds` fully rendered, dim or
 * freeze every other layer per `settings.mode`. Captures a single-level
 * unisolate snapshot in `LayerStore` for restore via `LayerUnisolateCommand`.
 *
 * Second execution while a session is active emits a warning toast (handled
 * by the UI dispatch layer; the command sets a `wasOverwrite` flag readable
 * via `didOverwritePreviousSnapshot()`) and overwrites the snapshot with the
 * current visible state (single-level semantics).
 *
 * Replay-safety: snapshot captured on first `execute()` only; redo applies
 * the same snapshot delta without re-capturing.
 *
 * ADR-616 — id/timestamp/affected-ids boilerplate inherited from
 * {@link LayerCommandBase}; the isolate lifecycle stays bespoke here.
 */

import type {
  LayerIsolateMode,
  LayerIsolateSettings,
} from '../../../services/layer-isolate-resolver';
import {
  setIsolateEffects,
  clearIsolateEffects,
} from '../../../systems/isolate/IsolateEffectsStore';
import { getAllLayers } from '../../../stores/LayerStore';
import {
  captureAllLayersSnapshot,
  dropUnisolateSnapshot,
  freezeNonIsolatedLayers,
  persistUnisolateSnapshot,
  readUnisolateSnapshot,
  restoreLayersSnapshot,
  type UnisolateSnapshotEntry,
} from './layer-command-utils';
import { LayerCommandBase } from './layer-command-base';

export interface LayerIsolateInput {
  /** Layers kept fully visible/un-dimmed. */
  targetLayerIds: ReadonlyArray<string>;
  /** Resolved settings (mode + dim opacity %). */
  settings: LayerIsolateSettings;
  /** Optional human-readable category for the status-bar badge. */
  category?: string | null;
}

/**
 * Serialized `data` payload for a `LayerIsolateInput`. Shared by
 * `LayerIsolateCommand` and its inverse wrapper so the serialize shape lives in
 * one place (ADR-616).
 */
export function serializeLayerIsolateInput(input: LayerIsolateInput): Record<string, unknown> {
  return {
    targetLayerIds: [...input.targetLayerIds],
    settings: { ...input.settings },
    category: input.category ?? null,
  };
}

export class LayerIsolateCommand extends LayerCommandBase {
  readonly name = 'LayerIsolate';
  readonly type = 'layer-isolate';

  private capturedSnapshot: ReadonlyArray<UnisolateSnapshotEntry> | null = null;
  private wasOverwrite = false;

  constructor(private readonly input: LayerIsolateInput) {
    super('layer-isolate');
  }

  execute(): void {
    if (!this.wasExecuted) {
      this.wasOverwrite = readUnisolateSnapshot() !== null;
      this.capturedSnapshot = captureAllLayersSnapshot();
      persistUnisolateSnapshot(this.capturedSnapshot);
      this.wasExecuted = true;
    }
    this.applyEffects();
  }

  undo(): void {
    if (!this.capturedSnapshot) return;
    restoreLayersSnapshot(this.capturedSnapshot);
    dropUnisolateSnapshot();
    clearIsolateEffects();
  }

  redo(): void {
    this.applyEffects();
  }

  /** True if the command overwrote a previously-active snapshot. */
  didOverwritePreviousSnapshot(): boolean {
    return this.wasOverwrite;
  }

  getDescription(): string {
    const mode: LayerIsolateMode = this.input.settings.mode;
    return `Isolate ${this.input.targetLayerIds.length} layer(s) — ${mode}`;
  }

  protected serializeData(): Record<string, unknown> {
    return serializeLayerIsolateInput(this.input);
  }

  private applyEffects(): void {
    const keepSet = new Set(this.input.targetLayerIds);
    if (this.input.settings.mode === 'freeze') {
      freezeNonIsolatedLayers(getAllLayers(), keepSet);
    }
    setIsolateEffects({
      mode: this.input.settings.mode,
      isolatedLayerIds: keepSet,
      dimOpacityPercent: this.input.settings.dimOpacityPercent,
      category: this.input.category ?? null,
    });
  }
}
