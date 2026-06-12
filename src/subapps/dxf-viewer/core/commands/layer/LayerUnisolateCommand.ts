/**
 * LayerUnisolateCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Tear down the active isolate session: restore every layer flag from the
 * `unisolateSnapshot` captured by `LayerIsolateCommand`, clear the snapshot,
 * and deactivate `IsolateEffectsStore`. Idempotent if no snapshot is present.
 *
 * `undo()` re-applies the snapshot conserved in the command instance (replay
 * safe — restores both layer flags and the isolate effects state captured at
 * execute time).
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import {
  clearIsolateEffects,
  getIsolateEffectsSnapshot,
  setIsolateEffects,
  type IsolateEffectsSnapshot
} from '../../../systems/isolate/IsolateEffectsStore';
import {
  captureAllLayersSnapshot,
  dropUnisolateSnapshot,
  makeLayerCommandKey,
  persistUnisolateSnapshot,
  readUnisolateSnapshot,
  restoreLayersSnapshot,
  type UnisolateSnapshotEntry
} from './layer-command-utils';

export class LayerUnisolateCommand implements ICommand {
  readonly id: string;
  readonly name = 'LayerUnisolate';
  readonly type = 'layer-unisolate';
  readonly timestamp: number;

  private restoredSnapshot: ReadonlyArray<UnisolateSnapshotEntry> | null = null;
  private preUndoSnapshot: ReadonlyArray<UnisolateSnapshotEntry> | null = null;
  private isolateEffectsAtExecute: IsolateEffectsSnapshot | null = null;
  private wasExecuted = false;

  constructor() {
    this.id = makeLayerCommandKey('layer-unisolate');
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.wasExecuted) {
      this.replayExecute();
      return;
    }
    const snap = readUnisolateSnapshot();
    if (!snap) {
      // ADR-358 §5.6.bis — entity-scoped isolate (EntityIsolateCommand) leaves no
      // layer snapshot (it never mutates layer flags). Still tear down the active
      // session so the same Ctrl+Shift+U / status-badge clears it.
      const effects = getIsolateEffectsSnapshot();
      if (effects.active) {
        this.isolateEffectsAtExecute = effects;
        clearIsolateEffects();
      }
      this.wasExecuted = true;
      return;
    }
    this.restoredSnapshot = snap;
    this.isolateEffectsAtExecute = getIsolateEffectsSnapshot();
    this.preUndoSnapshot = captureAllLayersSnapshot();
    restoreLayersSnapshot(snap);
    dropUnisolateSnapshot();
    clearIsolateEffects();
    this.wasExecuted = true;
  }

  undo(): void {
    // Entity-scoped teardown leaves no layer snapshot — just re-activate the
    // isolate session that was torn down at execute time.
    if (!this.restoredSnapshot) {
      this.reapplyIsolateEffectsAtExecute();
      return;
    }
    if (this.preUndoSnapshot) {
      restoreLayersSnapshot(this.preUndoSnapshot);
    }
    persistUnisolateSnapshot(this.restoredSnapshot);
    this.reapplyIsolateEffectsAtExecute();
  }

  private reapplyIsolateEffectsAtExecute(): void {
    const effects = this.isolateEffectsAtExecute;
    if (effects && effects.active) {
      setIsolateEffects({
        mode: effects.mode,
        isolatedLayerIds: effects.isolatedLayerIds,
        isolatedEntityIds: effects.isolatedEntityIds,
        isolatedCategories: effects.isolatedCategories,
        dimOpacityPercent: effects.dimOpacityPercent,
        category: effects.category
      });
    }
  }

  redo(): void {
    this.replayExecute();
  }

  getDescription(): string {
    return 'Unisolate layers';
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {},
      version: 1
    };
  }

  getAffectedEntityIds(): string[] {
    return [];
  }

  private replayExecute(): void {
    if (!this.restoredSnapshot) return;
    restoreLayersSnapshot(this.restoredSnapshot);
    dropUnisolateSnapshot();
    clearIsolateEffects();
  }
}
