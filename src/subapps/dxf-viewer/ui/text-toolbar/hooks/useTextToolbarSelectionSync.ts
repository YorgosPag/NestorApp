'use client';

/**
 * ADR-344 Phase 6.E — Selection → Toolbar populate bridge.
 *
 * AutoCAD parity: equivalent to AutoCAD's "PROPERTIES on selection-change"
 * event — the global pick-set is the SSoT, every observer (Properties
 * palette, Quick Properties, ribbon contextual tab) reads from it.
 *
 * Pipeline:
 *   1. `useUniversalSelection` is the canonical pick-set (Tier-1 SSoT).
 *   2. We filter for entities of `dxf-entity` type AND resolve each ID
 *      against the current scene to keep only TEXT/MTEXT nodes.
 *   3. `useTextSelectionStore.setSelection(ids)` is mirrored so other
 *      text-engine consumers (capabilities hook, FindReplaceDialog…)
 *      stay in lock-step.
 *   4. `computeMixedValues(selection)` collapses agreement/mixed values
 *      across the selection.
 *   5. `useTextToolbarStore.populate(values)` writes the values atomically
 *      with the `isPopulating` flag raised — the command-bridge skips
 *      these updates so the populate cycle never enters CommandHistory.
 *
 * The hook is effect-only; it returns nothing. Mount it once at the
 * Text Properties panel host or any ribbon root that owns text editing.
 *
 * ADR-040 note: this hook is safe to call from desktop chrome (panel
 * hosts, ribbon shells) — it has zero canvas-level frequency, only
 * fires when the pick-set changes (low rate).
 */

import { useEffect } from 'react';
import { useUniversalSelection } from '../../../systems/selection';
import { useCurrentSceneModel } from './useCurrentSceneModel';
import {
  useTextSelectionStore,
  useTextToolbarStore,
  computeMixedValues,
} from '../../../state/text-toolbar';
import { ensureTextNode } from '../../../text-engine/edit';
import type { SceneModel, AnySceneEntity } from '../../../types/scene';
import type { DxfTextNode } from '../../../text-engine/types';

interface ResolvedTextEntity {
  readonly id: string;
  readonly node: DxfTextNode;
  readonly layerId: string;
}

function resolveTextEntities(
  ids: readonly string[],
  scene: SceneModel | null,
): ResolvedTextEntity[] {
  if (!scene || ids.length === 0) return [];
  const byId = new Map<string, AnySceneEntity>();
  for (const e of scene.entities) byId.set(e.id, e);
  const out: ResolvedTextEntity[] = [];
  for (const id of ids) {
    const entity = byId.get(id);
    if (!entity) continue;
    if (entity.type !== 'text' && entity.type !== 'mtext') continue;
    out.push({
      id: entity.id,
      node: ensureTextNode(entity as unknown as Parameters<typeof ensureTextNode>[0]),
      layerId: entity.layer ?? '',
    });
  }
  return out;
}

export function useTextToolbarSelectionSync(): void {
  const selection = useUniversalSelection();
  const scene = useCurrentSceneModel();
  const setTextSelection = useTextSelectionStore((s) => s.setSelection);
  const populate = useTextToolbarStore((s) => s.populate);

  // Re-derive on every selection or scene change. Both sources update at
  // human-event rate (click / scene swap), so this is not a hot path.
  const allIds = selection.getIds();
  const idsKey = allIds.join(',');

  useEffect(() => {
    const resolved = resolveTextEntities(allIds, scene);
    const textIds = resolved.map((r) => r.id);
    setTextSelection(textIds);
    if (resolved.length === 0) return;
    const values = computeMixedValues(
      resolved.map((r) => ({ node: r.node, layerId: r.layerId })),
    );
    populate(values);
    // `allIds` is captured indirectly via idsKey to keep the dep array stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, scene, setTextSelection, populate]);
}
