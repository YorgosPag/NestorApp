/**
 * RestoreLayerStateCommand — ADR-358 §5.9 (Q12 FULL Enterprise) — Phase 12.
 *
 * Apply a previously-saved `LayerState` atomically + undo-ably:
 *   - `execute()` captures the live LayerStore snapshot, applies the target
 *     state in a single notify cycle, and marks `currentStateId` in the
 *     `LayerStateStore`.
 *   - `undo()` re-applies the captured pre-state and restores the previous
 *     `currentStateId`.
 *   - `redo()` re-applies the target without re-capturing — replay-safe.
 *
 * Match policy (delegated to `LayerStore.applyLayerSnapshotEntries`):
 *   1. `layerId` exact match (intra-project restore).
 *   2. `layerName` case-insensitive fallback (cross-project `.las` Phase 13).
 *   3. Snapshot entries with no live match are reported back via
 *      `getUnmatchedLayerNames()` so the UI can surface a toast.
 *
 * Pre-commit ratchet `layer-state-system` allowlists this file for direct
 * `applyLayerSnapshotEntries` invocation.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import {
  applyLayerSnapshotEntries,
  upsertLayer,
  removeLayer,
  type LayerSnapshotEntryInput,
} from '../../../stores/LayerStore';
import {
  getCurrentStateId,
  getLayerState,
  markCurrentLayerState,
  captureCurrentSnapshot,
} from '../../../stores/LayerStateStore';
import type { LayerStateEntry } from '../../../types/layer-state';
import { makeLayerCommandKey } from './layer-command-utils';
import { createSceneLayer } from '../../../types/entities';

export interface RestoreLayerStateOptions {
  /** When true, snapshot entries with no live match are created as new layers. Default: false. */
  readonly createMissingLayers: boolean;
}

export interface RestoreLayerStateInput {
  /** Id of the target saved state to apply. */
  readonly stateId: string;
  /** Apply policy options. Defaults to `{ createMissingLayers: false }`. */
  readonly options?: RestoreLayerStateOptions;
}

export class RestoreLayerStateCommand implements ICommand {
  readonly id: string;
  readonly name = 'RestoreLayerState';
  readonly type = 'layer-state-restore';
  readonly timestamp: number;

  private capturedPreState: ReadonlyArray<LayerStateEntry> | null = null;
  private previousCurrentStateId: string | null = null;
  private unmatchedLayerNames: ReadonlyArray<string> = [];
  private createdLayerIds: ReadonlyArray<string> = [];
  private wasExecuted = false;

  private readonly opts: RestoreLayerStateOptions;

  constructor(private readonly input: RestoreLayerStateInput) {
    this.id = makeLayerCommandKey('layer-state-restore');
    this.timestamp = Date.now();
    this.opts = input.options ?? { createMissingLayers: false };
  }

  execute(): void {
    const target = getLayerState(this.input.stateId);
    if (!target) return;
    if (!this.wasExecuted) {
      this.capturedPreState = captureCurrentSnapshot();
      this.previousCurrentStateId = getCurrentStateId();
      this.wasExecuted = true;
    }
    const result = applyLayerSnapshotEntries(toSnapshotInputs(target.snapshot));
    this.unmatchedLayerNames = result.unmatched;
    if (this.opts.createMissingLayers && result.unmatched.length > 0) {
      this.createdLayerIds = this.createMissingLayers(target.snapshot, result.unmatched);
      // Re-apply so newly created layers receive the state values.
      applyLayerSnapshotEntries(toSnapshotInputs(target.snapshot));
      this.unmatchedLayerNames = [];
    }
    markCurrentLayerState(this.input.stateId);
  }

  undo(): void {
    if (!this.capturedPreState) return;
    for (const id of this.createdLayerIds) {
      removeLayer(id);
    }
    applyLayerSnapshotEntries(toSnapshotInputs(this.capturedPreState));
    markCurrentLayerState(this.previousCurrentStateId);
  }

  redo(): void {
    const target = getLayerState(this.input.stateId);
    if (!target) return;
    applyLayerSnapshotEntries(toSnapshotInputs(target.snapshot));
    markCurrentLayerState(this.input.stateId);
  }

  getDescription(): string {
    const target = getLayerState(this.input.stateId);
    return `Restore layer state — ${target?.name ?? this.input.stateId}`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        stateId: this.input.stateId,
        options: { createMissingLayers: this.opts.createMissingLayers },
      },
      version: 2,
    };
  }

  getAffectedEntityIds(): string[] {
    return [];
  }

  /** Names of snapshot entries the live LayerStore could not match. */
  getUnmatchedLayerNames(): ReadonlyArray<string> {
    return this.unmatchedLayerNames;
  }

  private createMissingLayers(
    snapshot: ReadonlyArray<LayerStateEntry>,
    unmatchedNames: ReadonlyArray<string>,
  ): ReadonlyArray<string> {
    const unmatchedSet = new Set(unmatchedNames.map((n) => n.toLowerCase()));
    const created: string[] = [];
    for (const entry of snapshot) {
      if (!unmatchedSet.has(entry.layerName.toLowerCase())) continue;
      const newLayer = createSceneLayer({
        id: entry.layerId,
        name: entry.layerName,
        visible: entry.visible,
        frozen: entry.frozen,
        locked: entry.locked,
        color: entry.color,
        linetype: entry.linetype,
        lineweight: entry.lineweight,
        transparency: entry.transparency,
        plottable: entry.plottable,
        source: 'user-created',
      });
      upsertLayer(newLayer);
      created.push(newLayer.id);
    }
    return Object.freeze(created);
  }
}

function toSnapshotInputs(
  entries: ReadonlyArray<LayerStateEntry>,
): ReadonlyArray<LayerSnapshotEntryInput> {
  return entries.map((entry) => ({
    layerId: entry.layerId,
    layerName: entry.layerName,
    visible: entry.visible,
    frozen: entry.frozen,
    locked: entry.locked,
    color: entry.color,
    colorAci: entry.colorAci,
    colorTrueColor: entry.colorTrueColor,
    linetype: entry.linetype,
    lineweight: entry.lineweight,
    transparency: entry.transparency,
    plottable: entry.plottable,
  }));
}
