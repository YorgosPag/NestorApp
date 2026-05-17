/**
 * LayerThawAllCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Restore `frozen: false` on every currently-frozen layer (`LAYTHW` AutoCAD).
 * Shortcut `Ctrl+Shift+T`. Replay-safe: snapshot of frozen layers is captured
 * on first `execute()` and reused on `redo()`.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import { getAllLayers, upsertLayer } from '../../../stores/LayerStore';
import {
  makeLayerCommandKey,
  mutateAllLayersFlag,
  restoreLayersSnapshot,
  type UnisolateSnapshotEntry
} from './layer-command-utils';

export class LayerThawAllCommand implements ICommand {
  readonly id: string;
  readonly name = 'LayerThawAll';
  readonly type = 'layer-thaw-all';
  readonly timestamp: number;

  private mutatedSnapshot: ReadonlyArray<UnisolateSnapshotEntry> | null = null;
  private wasExecuted = false;

  constructor() {
    this.id = makeLayerCommandKey('layer-thaw-all');
    this.timestamp = Date.now();
  }

  execute(): void {
    if (!this.wasExecuted) {
      this.mutatedSnapshot = mutateAllLayersFlag('frozen', false);
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

  getDescription(): string {
    return 'Thaw all layers';
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
    for (const layer of getAllLayers()) {
      if (!layer.frozen) continue;
      upsertLayer({ ...layer, frozen: false });
    }
  }
}
