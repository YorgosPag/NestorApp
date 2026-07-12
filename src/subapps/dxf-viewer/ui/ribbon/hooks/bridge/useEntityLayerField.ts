'use client';

/**
 * ADR-507 / ADR-510 Φ4 — SSoT «Επίπεδο» (layer) πεδίο για per-entity bridges.
 *
 * Read = live layer catalog (`LayerStore`) + per-object `entityLayerValue`. Write =
 * selected → undoable `patchEntity({ layerId })`· χωρίς επιλογή (draw-defaults) → η
 * ΚΟΙΝΗ current-layer SSoT action (`changeCurrentLayer`: permission gate + toast +
 * recent FIFO), ίδιο path με το `useRibbonLineToolBridge` και τον CurrentLayerPicker.
 *
 * Εξάγεται εδώ ώστε η γραμμή & η γραμμοσκίαση να μοιράζονται ΕΝΑ layer-field wiring
 * (μηδέν clone, N.18· κρατά και τον hatch bridge κάτω από το 500-line budget).
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { getLayerStoreSnapshot, subscribeLayerStore } from '../../../../stores/LayerStore';
import { buildLayerOptions, entityLayerValue } from '../useRibbonLineToolBridge.helpers';
import { useCurrentLayerChange } from '../../../components/layer-picker/useCurrentLayerChange';
import { useEntityPatchCommand } from '../../../../hooks/commands/useEntityPatchCommand';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';
import type { AnySceneEntity } from '../../../../types/entities';
import type { SceneAdapterLevelManager } from '../../../../systems/entity-creation/useSceneManagerAdapter';

export interface EntityLayerField {
  /** Combobox state (value = per-object / current layer· options = live catalog). */
  readonly getState: (selected: AnySceneEntity | null) => RibbonComboboxState;
  /** selected → per-object `layerId`· χωρίς επιλογή → current drawing layer. */
  readonly apply: (selected: AnySceneEntity | null, value: string) => void;
}

export function useEntityLayerField(levelManager: SceneAdapterLevelManager): EntityLayerField {
  const layerSnapshot = useSyncExternalStore(
    subscribeLayerStore, getLayerStoreSnapshot, getLayerStoreSnapshot,
  );
  const { changeCurrentLayer } = useCurrentLayerChange();
  const patchEntity = useEntityPatchCommand(levelManager);

  const options = useMemo(() => buildLayerOptions(layerSnapshot.layers), [layerSnapshot]);

  const getState = useCallback(
    (selected: AnySceneEntity | null): RibbonComboboxState => ({
      value: selected ? entityLayerValue(selected) : (layerSnapshot.currentLayerId ?? ''),
      options,
    }),
    [options, layerSnapshot],
  );

  const apply = useCallback(
    (selected: AnySceneEntity | null, value: string): void => {
      if (selected) patchEntity(selected.id, { layerId: value }, 'Update layer');
      else changeCurrentLayer(value);
    },
    [patchEntity, changeCurrentLayer],
  );

  return { getState, apply };
}
