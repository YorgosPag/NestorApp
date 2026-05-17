/**
 * LayerIsolateInverseCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Single-shot variant of `LayerIsolateCommand` that uses the OPPOSITE mode of
 * the project setting. Shortcut `Ctrl+Alt+I`. Does NOT mutate project
 * settings — it constructs a one-time effective settings object with mode
 * flipped, then delegates to `LayerIsolateCommand`.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import { inverseMode, type LayerIsolateSettings } from '../../../services/layer-isolate-resolver';
import { LayerIsolateCommand, type LayerIsolateInput } from './LayerIsolateCommand';
import { makeLayerCommandKey } from './layer-command-utils';

export type LayerIsolateInverseInput = LayerIsolateInput;

export class LayerIsolateInverseCommand implements ICommand {
  readonly id: string;
  readonly name = 'LayerIsolateInverse';
  readonly type = 'layer-isolate-inverse';
  readonly timestamp: number;

  private inner: LayerIsolateCommand;

  constructor(private readonly input: LayerIsolateInverseInput) {
    this.id = makeLayerCommandKey('layer-isolate-inverse');
    this.timestamp = Date.now();
    const flipped: LayerIsolateSettings = {
      mode: inverseMode(input.settings.mode),
      dimOpacityPercent: input.settings.dimOpacityPercent
    };
    this.inner = new LayerIsolateCommand({
      targetLayerIds: input.targetLayerIds,
      settings: flipped,
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
    return `Isolate (inverse) ${this.input.targetLayerIds.length} layer(s)`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        targetLayerIds: [...this.input.targetLayerIds],
        settings: { ...this.input.settings },
        category: this.input.category ?? null
      },
      version: 1
    };
  }

  getAffectedEntityIds(): string[] {
    return [];
  }
}
