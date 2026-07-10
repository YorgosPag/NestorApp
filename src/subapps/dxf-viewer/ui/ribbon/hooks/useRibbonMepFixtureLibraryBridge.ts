'use client';

/**
 * ADR-411 — Bridge between the contextual light-fixture LIBRARY ribbon tab and
 * the active MEP fixture placement tool (`mepFixtureToolBridgeStore`).
 *
 * Drawing-mode ONLY (mirror of `useRibbonFurnitureBridge`): a fixture is placed
 * via the tool, so the ribbon reads/writes the tool handle. Picking a catalog
 * model → `setAssetId` (`''` ⇒ parametric); rotation / scale → `setParamOverrides`.
 * The next click places the chosen model with the chosen transform.
 *
 * Distinct from `useRibbonMepFixtureBridge` (ADR-406, selected-entity property
 * editor). No-ops for commandKeys outside `MEP_FIXTURE_LIBRARY_*` so it composes
 * with the other bridges in `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 */

import { mepFixtureToolBridgeStore } from './bridge/mep-fixture-tool-bridge-store';
import {
  MEP_FIXTURE_LIBRARY_KEYS,
  MEP_FIXTURE_LIBRARY_KEYS_ACTIONS,
} from './bridge/mep-fixture-library-command-keys';
import { LIGHT_FIXTURE_CATALOG } from '../../../bim/mep-fixtures/light-fixture-catalog';
import { bimMeshThumbnailStore } from '../../../bim-3d/library/bim-mesh-library/bim-mesh-thumbnail-cache';
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import type { RibbonEntityBridgeCore } from './ribbon-entity-bridge-shared';
import {
  useToolHandleBridge,
  useThumbnailPreload,
  buildMeshCatalogOptions,
} from './ribbon-tool-handle-bridge-shared';

/** BIM category → Storage library folder for light-fixture meshes. */
const LIGHT_FIXTURE_MESH_CATEGORY = 'light-fixture';

export type RibbonMepFixtureLibraryBridge = RibbonEntityBridgeCore;

/** commandKey → numeric override field on MepFixtureParamOverrides. */
const NUMBER_KEY_TO_OVERRIDE: Readonly<Record<string, 'rotation' | 'scaleOverride'>> = {
  [MEP_FIXTURE_LIBRARY_KEYS.params.rotation]: 'rotation',
  [MEP_FIXTURE_LIBRARY_KEYS.params.scale]: 'scaleOverride',
};

const NUMBER_KEY_DEFAULT: Readonly<Record<string, number>> = {
  [MEP_FIXTURE_LIBRARY_KEYS.params.rotation]: 0,
  [MEP_FIXTURE_LIBRARY_KEYS.params.scale]: 1,
};

export function useRibbonMepFixtureLibraryBridge(): RibbonMepFixtureLibraryBridge {
  const toolHandle = mepFixtureToolBridgeStore.use();
  const thumbVersion = bimMeshThumbnailStore.use();

  const isActive = !!toolHandle && toolHandle.isActive;
  useThumbnailPreload(isActive, LIGHT_FIXTURE_MESH_CATEGORY, LIGHT_FIXTURE_CATALOG.map((p) => p.id));

  return useToolHandleBridge({
    toolHandle,
    readImperative: () => mepFixtureToolBridgeStore.get(),
    assetIdKey: MEP_FIXTURE_LIBRARY_KEYS.stringParams.assetId,
    // Parametric default + CC0 assets carrying preview thumbnails. The parametric
    // option uses SELECT_CLEAR_VALUE (Radix Select forbids '').
    buildOptions: () => [
      { value: SELECT_CLEAR_VALUE, labelKey: 'ribbon.commands.mepFixtureLibrary.parametric', isLiteralLabel: false },
      ...buildMeshCatalogOptions(LIGHT_FIXTURE_CATALOG, LIGHT_FIXTURE_MESH_CATEGORY),
    ],
    numberKeyToField: NUMBER_KEY_TO_OVERRIDE,
    numberKeyDefault: NUMBER_KEY_DEFAULT,
    // Displayed value maps '' (parametric) → the SELECT_CLEAR_VALUE sentinel and back.
    displayAssetId: (handle) => handle.assetId || SELECT_CLEAR_VALUE,
    mapAssetIdValue: (value) => (isSelectClearValue(value) ? '' : value),
    optionsDeps: [thumbVersion],
  });
}

/** Type guard used by `useRibbonCommands` composer (no library visibility keys). */
export function isMepFixtureLibraryPanelVisibilityKey(_visibilityKey: string): boolean {
  return false;
}

/** Exposed so the action interceptor can recognise library actions. */
export const MEP_FIXTURE_LIBRARY_BRIDGE_ACTIONS = MEP_FIXTURE_LIBRARY_KEYS_ACTIONS;
