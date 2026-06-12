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
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import {
  clearIsolateEffects,
  getIsolateEffectsSnapshot,
  setIsolateEffects,
  type IsolateEffectsSnapshot
} from '../../../systems/isolate/IsolateEffectsStore';
import { makeLayerCommandKey } from './layer-command-utils';

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

export class EntityIsolateCommand implements ICommand {
  readonly id: string;
  readonly name = 'EntityIsolate';
  readonly type = 'entity-isolate';
  readonly timestamp: number;

  private effectsBeforeExecute: IsolateEffectsSnapshot | null = null;
  private wasExecuted = false;

  constructor(private readonly input: EntityIsolateInput) {
    this.id = makeLayerCommandKey('entity-isolate');
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
    return `Isolate ${this.input.targetEntityIds.length} object(s) — ${this.input.mode ?? 'freeze'}`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        targetEntityIds: [...this.input.targetEntityIds],
        mode: this.input.mode ?? 'freeze',
        dimOpacityPercent: this.input.dimOpacityPercent ?? 30,
        category: this.input.category ?? null
      },
      version: 1
    };
  }

  getAffectedEntityIds(): string[] {
    return [...this.input.targetEntityIds];
  }

  private applyEffects(): void {
    setIsolateEffects({
      mode: this.input.mode ?? 'freeze',
      isolatedLayerIds: [],
      isolatedEntityIds: new Set(this.input.targetEntityIds),
      dimOpacityPercent: this.input.dimOpacityPercent ?? 30,
      category: this.input.category ?? null
    });
  }
}
