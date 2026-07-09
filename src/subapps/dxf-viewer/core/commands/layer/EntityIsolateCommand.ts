/**
 * EntityIsolateCommand — Revit-style "Isolate Element" (ADR-358 §5.6.bis).
 *
 * Entity-scoped sibling of `LayerIsolateCommand`: keeps ONLY the given entity
 * ids visible and hides everything else — across BOTH the 2D canvas
 * (`DxfRenderer`) and the 3D scene (`resolveIsEntityVisible`). Unlike layer
 * isolate it does NOT mutate any layer flags (the isolated entities may share a
 * layer with others), so there is no layer snapshot to capture: the effect
 * lives purely in `IsolateEffectsStore.isolatedEntityIds`.
 *
 * Default mode is `'freeze'` (hide the rest) so a single click yields the
 * Revit "show only this" result on both canvases. Undo restores the previous
 * isolate session (if any) or clears the effects entirely. Replay-safe.
 *
 * Teardown is shared with layer isolate: `LayerUnisolateCommand`, the
 * status-bar badge, and Ctrl+Shift+U all clear an entity-scoped session too.
 *
 * ADR-616 — snapshot/apply/restore lifecycle inherited from {@link IsolateEffectsCommand}.
 */

import { setIsolateEffects } from '../../../systems/isolate/IsolateEffectsStore';
import { IsolateEffectsCommand } from './layer-command-base';

export interface EntityIsolateInput {
  /** Entity ids kept visible — everything else is hidden (freeze) / dimmed (dim). */
  targetEntityIds: ReadonlyArray<string>;
  /** Isolate mode. Defaults to `'freeze'` (Revit "show only this"). */
  mode?: 'dim' | 'freeze';
  /** Dim opacity percent (5..90) when `mode === 'dim'`. Defaults to 30. */
  dimOpacityPercent?: number;
  /** Optional human-readable label for the status-bar badge. */
  category?: string | null;
}

export class EntityIsolateCommand extends IsolateEffectsCommand<EntityIsolateInput> {
  readonly name = 'EntityIsolate';
  readonly type = 'entity-isolate';

  constructor(input: EntityIsolateInput) {
    super('entity-isolate', input);
  }

  protected applyEffects(): void {
    setIsolateEffects({
      mode: this.input.mode ?? 'freeze',
      isolatedLayerIds: [],
      isolatedEntityIds: new Set(this.input.targetEntityIds),
      dimOpacityPercent: this.input.dimOpacityPercent ?? 30,
      category: this.input.category ?? null,
    });
  }

  getDescription(): string {
    return `Isolate ${this.input.targetEntityIds.length} object(s) — ${this.input.mode ?? 'freeze'}`;
  }

  getAffectedEntityIds(): string[] {
    return [...this.input.targetEntityIds];
  }

  protected serializeData(): Record<string, unknown> {
    return {
      targetEntityIds: [...this.input.targetEntityIds],
      mode: this.input.mode ?? 'freeze',
      dimOpacityPercent: this.input.dimOpacityPercent ?? 30,
      category: this.input.category ?? null,
    };
  }
}
