/**
 * LayerOnAllCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Restore `visible: true` on every currently-invisible layer (`LAYON`
 * AutoCAD). Shortcut `Ctrl+Shift+O`. Replay-safe.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import { getAllLayers, upsertLayer } from '../../../stores/LayerStore';
import {
  makeLayerCommandKey,
  mutateAllLayersFlag,
  restoreLayersSnapshot,
  type UnisolateSnapshotEntry
} from './layer-command-utils';

export class LayerOnAllCommand implements ICommand {
  readonly id: string;
  readonly name = 'LayerOnAll';
  readonly type = 'layer-on-all';
  readonly timestamp: number;

  private mutatedSnapshot: ReadonlyArray<UnisolateSnapshotEntry> | null = null;
  private wasExecuted = false;

  constructor() {
    this.id = makeLayerCommandKey('layer-on-all');
    this.timestamp = Date.now();
  }

  execute(): void {
    if (!this.wasExecuted) {
      this.mutatedSnapshot = mutateAllLayersFlag('visible', true);
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
    return 'Turn on all layers';
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
      if (layer.visible) continue;
      upsertLayer({ ...layer, visible: true });
    }
  }
}
