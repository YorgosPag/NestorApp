/**
 * LayerFreezeCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Set `frozen: true` on a single layer (`LAYFRZ` AutoCAD click-driven). The
 * renderer skips frozen layers entirely for perf parity with AutoCAD. Idempotent.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import { getLayer, upsertLayer } from '../../../stores/LayerStore';
import { captureLayerSnapshot, makeLayerCommandKey, restoreLayerEntry, type UnisolateSnapshotEntry } from './layer-command-utils';

export interface LayerFreezeInput {
  layerId: string;
}

export class LayerFreezeCommand implements ICommand {
  readonly id: string;
  readonly name = 'LayerFreeze';
  readonly type = 'layer-freeze';
  readonly timestamp: number;

  private preState: UnisolateSnapshotEntry | null = null;
  private wasExecuted = false;
  private wasNoOp = false;

  constructor(private readonly input: LayerFreezeInput) {
    this.id = makeLayerCommandKey('layer-freeze');
    this.timestamp = Date.now();
  }

  execute(): void {
    if (!this.wasExecuted) {
      const layer = getLayer(this.input.layerId);
      if (!layer || layer.frozen === true) {
        this.wasNoOp = true;
        this.wasExecuted = true;
        return;
      }
      this.preState = captureLayerSnapshot(this.input.layerId);
      this.wasExecuted = true;
    }
    if (this.wasNoOp) return;
    const layer = getLayer(this.input.layerId);
    if (!layer) return;
    upsertLayer({ ...layer, frozen: true });
  }

  undo(): void {
    if (this.wasNoOp || !this.preState) return;
    restoreLayerEntry(this.preState);
  }

  redo(): void {
    if (this.wasNoOp) return;
    const layer = getLayer(this.input.layerId);
    if (!layer) return;
    upsertLayer({ ...layer, frozen: true });
  }

  getDescription(): string {
    return `Freeze layer ${this.input.layerId}`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { layerId: this.input.layerId },
      version: 1
    };
  }

  getAffectedEntityIds(): string[] {
    return [];
  }
}
