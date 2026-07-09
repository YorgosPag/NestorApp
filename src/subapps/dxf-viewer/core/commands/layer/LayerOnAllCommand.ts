/**
 * LayerOnAllCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Restore `visible: true` on every currently-invisible layer (`LAYON`
 * AutoCAD). Shortcut `Ctrl+Shift+O`. Replay-safe.
 *
 * ADR-616 — mutate-all lifecycle inherited from {@link MutateAllLayersCommand}.
 */

import { MutateAllLayersCommand } from './layer-command-base';

export class LayerOnAllCommand extends MutateAllLayersCommand {
  readonly name = 'LayerOnAll';
  readonly type = 'layer-on-all';
  protected readonly flag = 'visible' as const;
  protected readonly targetValue = true;

  constructor() {
    super('layer-on-all');
  }

  getDescription(): string {
    return 'Turn on all layers';
  }
}
