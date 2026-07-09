/**
 * LayerDimCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Force `mode='dim'` single execution regardless of the project's resolved
 * isolate setting. Thin wrapper around `LayerIsolateCommand` with the mode
 * fixed at construction time.
 *
 * ADR-616 — delegation (execute/undo/redo → inner) inherited from
 * {@link DelegatingLayerCommand}.
 */

import { DelegatingLayerCommand } from './layer-command-base';
import { LayerIsolateCommand } from './LayerIsolateCommand';

export interface LayerDimInput {
  targetLayerIds: ReadonlyArray<string>;
  dimOpacityPercent: number;
  category?: string | null;
}

export class LayerDimCommand extends DelegatingLayerCommand {
  readonly name = 'LayerDim';
  readonly type = 'layer-dim';

  constructor(private readonly input: LayerDimInput) {
    super(
      'layer-dim',
      new LayerIsolateCommand({
        targetLayerIds: input.targetLayerIds,
        settings: { mode: 'dim', dimOpacityPercent: input.dimOpacityPercent },
        category: input.category ?? null,
      }),
    );
  }

  getDescription(): string {
    return `Dim ${this.input.targetLayerIds.length} layer(s)`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      targetLayerIds: [...this.input.targetLayerIds],
      dimOpacityPercent: this.input.dimOpacityPercent,
      category: this.input.category ?? null,
    };
  }
}
