/**
 * LayerIsolateInverseCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Single-shot variant of `LayerIsolateCommand` that uses the OPPOSITE mode of
 * the project setting. Shortcut `Ctrl+Alt+I`. Does NOT mutate project
 * settings — it constructs a one-time effective settings object with mode
 * flipped, then delegates to `LayerIsolateCommand`.
 *
 * ADR-616 — delegation (execute/undo/redo → inner) inherited from
 * {@link DelegatingLayerCommand}.
 */

import { inverseMode, type LayerIsolateSettings } from '../../../services/layer-isolate-resolver';
import {
  LayerIsolateCommand,
  serializeLayerIsolateInput,
  type LayerIsolateInput,
} from './LayerIsolateCommand';
import { DelegatingLayerCommand } from './layer-command-base';

export type LayerIsolateInverseInput = LayerIsolateInput;

export class LayerIsolateInverseCommand extends DelegatingLayerCommand {
  readonly name = 'LayerIsolateInverse';
  readonly type = 'layer-isolate-inverse';

  constructor(private readonly input: LayerIsolateInverseInput) {
    super('layer-isolate-inverse', new LayerIsolateCommand({
      targetLayerIds: input.targetLayerIds,
      settings: {
        mode: inverseMode(input.settings.mode),
        dimOpacityPercent: input.settings.dimOpacityPercent,
      } satisfies LayerIsolateSettings,
      category: input.category ?? null,
    }));
  }

  getDescription(): string {
    return `Isolate (inverse) ${this.input.targetLayerIds.length} layer(s)`;
  }

  protected serializeData(): Record<string, unknown> {
    return serializeLayerIsolateInput(this.input);
  }
}
