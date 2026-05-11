'use client';

/**
 * ADR-344 Phase 6.D — Layer source for the Text Properties panel.
 *
 * Maps every `SceneLayer` in the active scene to the panel's
 * `LayerSelectorEntry` shape. The DXF model only carries a `locked`
 * flag; `frozen` is not represented in `SceneLayer` yet, so it
 * defaults to `false`. When the layer subsystem grows a frozen
 * concept this is the single place to wire it.
 */

import { useMemo } from 'react';
import type { LayerSelectorEntry } from '../controls';
import { useCurrentSceneModel } from './useCurrentSceneModel';

const EMPTY: readonly LayerSelectorEntry[] = [];

export function useTextPanelLayers(): readonly LayerSelectorEntry[] {
  const scene = useCurrentSceneModel();
  return useMemo(() => {
    if (!scene) return EMPTY;
    return Object.values(scene.layers).map<LayerSelectorEntry>((l) => ({
      id: l.name,
      name: l.name,
      locked: l.locked,
      frozen: false,
    }));
  }, [scene]);
}
