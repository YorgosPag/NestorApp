/**
 * LayerDimCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Force `mode='dim'` single execution regardless of the project's resolved
 * isolate setting. Thin wrapper around `LayerIsolateCommand` with the mode
 * fixed at construction time.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import { LayerIsolateCommand } from './LayerIsolateCommand';
import { makeLayerCommandKey } from './layer-command-utils';

export interface LayerDimInput {
  targetLayerIds: ReadonlyArray<string>;
  dimOpacityPercent: number;
  category?: string | null;
}

export class LayerDimCommand implements ICommand {
  readonly id: string;
  readonly name = 'LayerDim';
  readonly type = 'layer-dim';
  readonly timestamp: number;

  private inner: LayerIsolateCommand;

  constructor(private readonly input: LayerDimInput) {
    this.id = makeLayerCommandKey('layer-dim');
    this.timestamp = Date.now();
    this.inner = new LayerIsolateCommand({
      targetLayerIds: input.targetLayerIds,
      settings: { mode: 'dim', dimOpacityPercent: input.dimOpacityPercent },
      category: input.category ?? null
    });
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

  getDescription(): string {
    return `Dim ${this.input.targetLayerIds.length} layer(s)`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        targetLayerIds: [...this.input.targetLayerIds],
        dimOpacityPercent: this.input.dimOpacityPercent,
        category: this.input.category ?? null
      },
      version: 1
    };
  }

  getAffectedEntityIds(): string[] {
    return [];
  }
}
