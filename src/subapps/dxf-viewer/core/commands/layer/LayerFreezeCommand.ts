/**
 * LayerFreezeCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Set `frozen: true` on a single layer (`LAYFRZ` AutoCAD click-driven). The
 * renderer skips frozen layers entirely for perf parity with AutoCAD. Idempotent.
 *
 * ADR-616 — toggle lifecycle (no-op guard + snapshot + restore) inherited from
 * {@link SingleLayerFlagCommand}.
 */

import { SingleLayerFlagCommand, type SingleLayerInput } from './layer-command-base';

export type LayerFreezeInput = SingleLayerInput;

export class LayerFreezeCommand extends SingleLayerFlagCommand {
  readonly name = 'LayerFreeze';
  readonly type = 'layer-freeze';
  protected readonly flag = 'frozen' as const;
  protected readonly targetValue = true;

  constructor(input: LayerFreezeInput) {
    super('layer-freeze', input);
  }

  getDescription(): string {
    return `Freeze layer ${this.input.layerId}`;
  }
}
