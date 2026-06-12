/**
 * CategoryIsolateCommand — Revit-style "Isolate Category" (ADR-358 §5.6.bis).
 *
 * Category-scoped sibling of `EntityIsolateCommand`: keeps ONLY entities whose
 * V/G `BimCategory` is in the target set visible (e.g. all walls) and hides
 * every other category — across both the 2D canvas (shared `DxfRenderer` gate)
 * and the 3D scene (`resolveIsEntityVisible`). LIVE: a newly drawn wall appears
 * automatically because visibility is gated at render time, not capture time.
 *
 * Does NOT mutate layer flags or the persisted V/G `objectStyles` — the effect
 * lives purely in `IsolateEffectsStore.isolatedCategories` (session-only,
 * undo-safe). Teardown is shared with the other isolate scopes:
 * `LayerUnisolateCommand`, the status-bar badge, and Ctrl+Shift+U.
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import type { BimCategory } from '../../../config/bim-object-styles';
import {
  clearIsolateEffects,
  getIsolateEffectsSnapshot,
  setIsolateEffects,
  type IsolateEffectsSnapshot
} from '../../../systems/isolate/IsolateEffectsStore';
import { makeLayerCommandKey } from './layer-command-utils';

export interface CategoryIsolateInput {
  /** Categories kept visible — every other category is hidden (freeze) / dimmed (dim). */
  targetCategories: ReadonlyArray<BimCategory>;
  /** Isolate mode. Defaults to `'freeze'` (Revit "show only this category"). */
  mode?: 'dim' | 'freeze';
  /** Dim opacity percent (5..90) when `mode === 'dim'`. Defaults to 30. */
  dimOpacityPercent?: number;
  /** Optional human-readable label for the status-bar badge. */
  category?: string | null;
}

export class CategoryIsolateCommand implements ICommand {
  readonly id: string;
  readonly name = 'CategoryIsolate';
  readonly type = 'category-isolate';
  readonly timestamp: number;

  private effectsBeforeExecute: IsolateEffectsSnapshot | null = null;
  private wasExecuted = false;

  constructor(private readonly input: CategoryIsolateInput) {
    this.id = makeLayerCommandKey('category-isolate');
    this.timestamp = Date.now();
  }

  execute(): void {
    if (!this.wasExecuted) {
      this.effectsBeforeExecute = getIsolateEffectsSnapshot();
      this.wasExecuted = true;
    }
    this.applyEffects();
  }

  undo(): void {
    const prev = this.effectsBeforeExecute;
    if (prev && prev.active) {
      setIsolateEffects({
        mode: prev.mode,
        isolatedLayerIds: prev.isolatedLayerIds,
        isolatedEntityIds: prev.isolatedEntityIds,
        isolatedCategories: prev.isolatedCategories,
        dimOpacityPercent: prev.dimOpacityPercent,
        category: prev.category
      });
      return;
    }
    clearIsolateEffects();
  }

  redo(): void {
    this.applyEffects();
  }

  getDescription(): string {
    return `Isolate ${this.input.targetCategories.length} category(ies) — ${this.input.mode ?? 'freeze'}`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        targetCategories: [...this.input.targetCategories],
        mode: this.input.mode ?? 'freeze',
        dimOpacityPercent: this.input.dimOpacityPercent ?? 30,
        category: this.input.category ?? null
      },
      version: 1
    };
  }

  getAffectedEntityIds(): string[] {
    return [];
  }

  private applyEffects(): void {
    setIsolateEffects({
      mode: this.input.mode ?? 'freeze',
      isolatedLayerIds: [],
      isolatedCategories: new Set(this.input.targetCategories),
      dimOpacityPercent: this.input.dimOpacityPercent ?? 30,
      category: this.input.category ?? null
    });
  }
}
