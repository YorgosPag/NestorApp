/**
 * LayerLockCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Set `locked: true` on a single layer (`LAYLCK` AutoCAD click-driven). Locked
 * layers stay visible but cannot be edited (Phase 9G UI guards `locked` for
 * edit/delete). Idempotent.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import { getLayer, upsertLayer } from '../../../stores/LayerStore';
import { captureLayerSnapshot, makeLayerCommandKey, restoreLayerEntry, type UnisolateSnapshotEntry } from './layer-command-utils';

export interface LayerLockInput {
  layerId: string;
}

export class LayerLockCommand implements ICommand {
  readonly id: string;
  readonly name = 'LayerLock';
  readonly type = 'layer-lock';
  readonly timestamp: number;

  private preState: UnisolateSnapshotEntry | null = null;
  private wasExecuted = false;
  private wasNoOp = false;

  constructor(private readonly input: LayerLockInput) {
    this.id = makeLayerCommandKey('layer-lock');
    this.timestamp = Date.now();
  }

  execute(): void {
    if (!this.wasExecuted) {
      const layer = getLayer(this.input.layerId);
      if (!layer || layer.locked === true) {
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
    upsertLayer({ ...layer, locked: true });
  }

  undo(): void {
    if (this.wasNoOp || !this.preState) return;
    restoreLayerEntry(this.preState);
  }

  redo(): void {
    if (this.wasNoOp) return;
    const layer = getLayer(this.input.layerId);
    if (!layer) return;
    upsertLayer({ ...layer, locked: true });
  }

  getDescription(): string {
    return `Lock layer ${this.input.layerId}`;
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
