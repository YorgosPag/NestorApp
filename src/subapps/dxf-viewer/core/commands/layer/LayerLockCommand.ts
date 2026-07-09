/**
 * LayerLockCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Set `locked: true` on a single layer (`LAYLCK` AutoCAD click-driven). Locked
 * layers stay visible but cannot be edited (Phase 9G UI guards `locked` for
 * edit/delete). Idempotent.
 *
 * ADR-616 — toggle lifecycle inherited from {@link SingleLayerFlagCommand}.
 */

import { SingleLayerFlagCommand, type SingleLayerInput } from './layer-command-base';

export type LayerLockInput = SingleLayerInput;

export class LayerLockCommand extends SingleLayerFlagCommand {
  readonly name = 'LayerLock';
  readonly type = 'layer-lock';
  protected readonly flag = 'locked' as const;
  protected readonly targetValue = true;

  constructor(input: LayerLockInput) {
    super('layer-lock', input);
  }

  getDescription(): string {
    return `Lock layer ${this.input.layerId}`;
  }
}
