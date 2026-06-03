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

import { useCallback, useEffect, useMemo } from 'react';
import { mepFixtureToolBridgeStore } from './bridge/mep-fixture-tool-bridge-store';
import {
  MEP_FIXTURE_LIBRARY_KEYS,
  MEP_FIXTURE_LIBRARY_KEYS_ACTIONS,
  isMepFixtureLibraryKey,
} from './bridge/mep-fixture-library-command-keys';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import { LIGHT_FIXTURE_CATALOG } from '../../../bim/mep-fixtures/light-fixture-catalog';
import { bimMeshThumbnailStore } from '../../../bim-3d/library/bim-mesh-library/bim-mesh-thumbnail-cache';
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';

/** BIM category → Storage library folder for light-fixture meshes. */
const LIGHT_FIXTURE_MESH_CATEGORY = 'light-fixture';

export interface RibbonMepFixtureLibraryBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

/** commandKey → numeric override field on MepFixtureParamOverrides. */
const NUMBER_KEY_TO_OVERRIDE: Readonly<Record<string, 'rotation' | 'scaleOverride'>> = {
  [MEP_FIXTURE_LIBRARY_KEYS.params.rotation]: 'rotation',
  [MEP_FIXTURE_LIBRARY_KEYS.params.scale]: 'scaleOverride',
};

const NUMBER_KEY_DEFAULT: Readonly<Record<string, number>> = {
  [MEP_FIXTURE_LIBRARY_KEYS.params.rotation]: 0,
  [MEP_FIXTURE_LIBRARY_KEYS.params.scale]: 1,
};

const NULL_TOGGLE: RibbonToggleState = false;

export function useRibbonMepFixtureLibraryBridge(): RibbonMepFixtureLibraryBridge {
  const toolHandle = mepFixtureToolBridgeStore.use();
  const thumbVersion = bimMeshThumbnailStore.use();

  const isActive = !!toolHandle && toolHandle.isActive;
  useEffect(() => {
    if (isActive) {
      bimMeshThumbnailStore.preloadMany(LIGHT_FIXTURE_MESH_CATEGORY, LIGHT_FIXTURE_CATALOG.map((p) => p.id));
    }
  }, [isActive]);

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!toolHandle || !toolHandle.isActive) return null;
      if (commandKey === MEP_FIXTURE_LIBRARY_KEYS.stringParams.assetId) {
        // Parametric default + CC0 assets carrying preview thumbnails. The
        // parametric option uses SELECT_CLEAR_VALUE (Radix Select forbids '').
        const options = [
          { value: SELECT_CLEAR_VALUE, labelKey: 'ribbon.commands.mepFixtureLibrary.parametric', isLiteralLabel: false },
          ...LIGHT_FIXTURE_CATALOG.map((p) => ({
            value: p.id,
            labelKey: p.labelKey,
            isLiteralLabel: false,
            imageUrl: bimMeshThumbnailStore.get(LIGHT_FIXTURE_MESH_CATEGORY, p.id),
          })),
        ];
        return { value: toolHandle.assetId || SELECT_CLEAR_VALUE, options };
      }
      if (isMepFixtureLibraryKey(commandKey)) {
        const field = NUMBER_KEY_TO_OVERRIDE[commandKey];
        const raw = toolHandle.overrides[field];
        const val = typeof raw === 'number' ? raw : NUMBER_KEY_DEFAULT[commandKey];
        return { value: String(val), options: [] };
      }
      return null;
    },
    [toolHandle, thumbVersion],
  );

  const onComboboxChange = useCallback((commandKey: string, value: string): void => {
    const handle = mepFixtureToolBridgeStore.get();
    if (!handle || !handle.isActive) return;
    if (commandKey === MEP_FIXTURE_LIBRARY_KEYS.stringParams.assetId) {
      // SELECT_CLEAR_VALUE (parametric) maps back to '' (no mesh).
      handle.setAssetId(isSelectClearValue(value) ? '' : value);
      return;
    }
    if (isMepFixtureLibraryKey(commandKey)) {
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      const field = NUMBER_KEY_TO_OVERRIDE[commandKey];
      handle.setParamOverrides({ [field]: numeric });
    }
  }, []);

  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op — included for interface parity */
  }, []);
  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);
  const onAction = useCallback((_action: string): void => {
    /* no-op — the tool-active tab auto-hides when the tool changes */
  }, []);
  const getPanelVisibility = useCallback((_visibilityKey: string): boolean => true, []);

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility],
  );
}

/** Type guard used by `useRibbonCommands` composer (no library visibility keys). */
export function isMepFixtureLibraryPanelVisibilityKey(_visibilityKey: string): boolean {
  return false;
}

/** Exposed so the action interceptor can recognise library actions. */
export const MEP_FIXTURE_LIBRARY_BRIDGE_ACTIONS = MEP_FIXTURE_LIBRARY_KEYS_ACTIONS;
