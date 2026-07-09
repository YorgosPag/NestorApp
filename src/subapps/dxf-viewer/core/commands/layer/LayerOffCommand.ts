/**
 * LayerOffCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Set `visible: false` on a single layer (`LAYOFF` AutoCAD click-driven).
 * Idempotent — no-op (and no snapshot capture) when layer already invisible.
 * `undo()` restores the pre-state visibility.
 *
 * ADR-616 — toggle lifecycle inherited from {@link SingleLayerFlagCommand}.
 */

import { SingleLayerFlagCommand, type SingleLayerInput } from './layer-command-base';

export type LayerOffInput = SingleLayerInput;

export class LayerOffCommand extends SingleLayerFlagCommand {
  readonly name = 'LayerOff';
  readonly type = 'layer-off';
  protected readonly flag = 'visible' as const;
  protected readonly targetValue = false;

  constructor(input: LayerOffInput) {
    super('layer-off', input);
  }

  getDescription(): string {
    return `Off layer ${this.input.layerId}`;
  }
}
