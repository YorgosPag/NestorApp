/**
 * LayerThawAllCommand — ADR-358 §5.6.bis — Phase 10.
 *
 * Restore `frozen: false` on every currently-frozen layer (`LAYTHW` AutoCAD).
 * Shortcut `Ctrl+Shift+T`. Replay-safe: snapshot of frozen layers is captured
 * on first `execute()` and reused on `redo()`.
 *
 * ADR-616 — mutate-all lifecycle inherited from {@link MutateAllLayersCommand}.
 */

import { MutateAllLayersCommand } from './layer-command-base';

export class LayerThawAllCommand extends MutateAllLayersCommand {
  readonly name = 'LayerThawAll';
  readonly type = 'layer-thaw-all';
  protected readonly flag = 'frozen' as const;
  protected readonly targetValue = false;

  constructor() {
    super('layer-thaw-all');
  }

  getDescription(): string {
    return 'Thaw all layers';
  }
}
