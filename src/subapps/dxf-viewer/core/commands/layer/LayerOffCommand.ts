/**
 * LayerOffCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Set `visible: false` on a single layer (`LAYOFF` AutoCAD click-driven).
 * Idempotent — no-op (and no snapshot capture) when layer already invisible.
 * `undo()` restores the pre-state visibility.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import { getLayer, upsertLayer } from '../../../stores/LayerStore';
import { captureLayerSnapshot, makeLayerCommandKey, restoreLayerEntry, type UnisolateSnapshotEntry } from './layer-command-utils';

export interface LayerOffInput {
  layerId: string;
}

export class LayerOffCommand implements ICommand {
  readonly id: string;
  readonly name = 'LayerOff';
  readonly type = 'layer-off';
  readonly timestamp: number;

  private preState: UnisolateSnapshotEntry | null = null;
  private wasExecuted = false;
  private wasNoOp = false;

  constructor(private readonly input: LayerOffInput) {
    this.id = makeLayerCommandKey('layer-off');
    this.timestamp = Date.now();
  }

  execute(): void {
    if (!this.wasExecuted) {
      const layer = getLayer(this.input.layerId);
      if (!layer || layer.visible === false) {
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
    upsertLayer({ ...layer, visible: false });
  }

  undo(): void {
    if (this.wasNoOp || !this.preState) return;
    restoreLayerEntry(this.preState);
  }

  redo(): void {
    if (this.wasNoOp) return;
    const layer = getLayer(this.input.layerId);
    if (!layer) return;
    upsertLayer({ ...layer, visible: false });
  }

  getDescription(): string {
    return `Off layer ${this.input.layerId}`;
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
