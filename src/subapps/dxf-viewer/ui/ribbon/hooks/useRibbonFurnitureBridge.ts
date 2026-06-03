'use client';

/**
 * ADR-410 — Bridge between the contextual furniture ribbon tab and the active
 * furniture placement tool (`furnitureToolBridgeStore`).
 *
 * Drawing-mode ONLY (mirror of the column bridge's drawing branch): furniture is
 * placed via the tool, so the ribbon reads/writes the tool handle — there is no
 * selected-entity editor branch yet. Picking a catalog model → `setAssetId`;
 * rotation / scale → `setParamOverrides`. The next click places the chosen model
 * with the chosen transform.
 *
 * No-ops for commandKeys outside `FURNITURE_RIBBON_KEYS` so it composes with the
 * other bridges in `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import { useCallback, useEffect, useMemo } from 'react';
import { furnitureToolBridgeStore } from './bridge/furniture-tool-bridge-store';
import {
  FURNITURE_RIBBON_KEYS,
  FURNITURE_RIBBON_KEYS_ACTIONS,
  isFurnitureRibbonKey,
} from './bridge/furniture-command-keys';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import { FURNITURE_CATALOG } from '../../../bim/furniture/furniture-catalog';
import { bimMeshThumbnailStore } from '../../../bim-3d/library/bim-mesh-library/bim-mesh-thumbnail-cache';

/** BIM category → Storage library folder for furniture meshes. */
const FURNITURE_MESH_CATEGORY = 'furniture';

export interface RibbonFurnitureBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

/** commandKey → numeric override field on FurnitureParamOverrides. */
const NUMBER_KEY_TO_OVERRIDE: Readonly<Record<string, 'rotationDeg' | 'scaleOverride' | 'mountingElevationMm'>> = {
  [FURNITURE_RIBBON_KEYS.params.rotation]: 'rotationDeg',
  [FURNITURE_RIBBON_KEYS.params.scale]: 'scaleOverride',
  [FURNITURE_RIBBON_KEYS.params.mountingElevation]: 'mountingElevationMm',
};

const NUMBER_KEY_DEFAULT: Readonly<Record<string, number>> = {
  [FURNITURE_RIBBON_KEYS.params.rotation]: 0,
  [FURNITURE_RIBBON_KEYS.params.scale]: 1,
  [FURNITURE_RIBBON_KEYS.params.mountingElevation]: 0,
};

const NULL_TOGGLE: RibbonToggleState = false;

export function useRibbonFurnitureBridge(): RibbonFurnitureBridge {
  // Subscribe to the tool handle so the ribbon re-renders on tool state changes.
  const toolHandle = furnitureToolBridgeStore.use();
  // Subscribe to thumbnail resolution so the catalog dropdown re-renders with
  // preview images once Storage URLs resolve (ADR-410 picker thumbnails).
  const thumbVersion = bimMeshThumbnailStore.use();

  const isActive = !!toolHandle && toolHandle.isActive;
  useEffect(() => {
    if (isActive) {
      bimMeshThumbnailStore.preloadMany(FURNITURE_MESH_CATEGORY, FURNITURE_CATALOG.map((p) => p.id));
    }
  }, [isActive]);

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!toolHandle || !toolHandle.isActive) return null;
      if (commandKey === FURNITURE_RIBBON_KEYS.stringParams.assetId) {
        // Dynamic options carrying preview thumbnails (overrides the static list).
        const options = FURNITURE_CATALOG.map((p) => ({
          value: p.id,
          labelKey: p.labelKey,
          isLiteralLabel: false,
          imageUrl: bimMeshThumbnailStore.get(FURNITURE_MESH_CATEGORY, p.id),
        }));
        return { value: toolHandle.assetId, options };
      }
      if (isFurnitureRibbonKey(commandKey)) {
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
    const handle = furnitureToolBridgeStore.get();
    if (!handle || !handle.isActive) return;
    if (commandKey === FURNITURE_RIBBON_KEYS.stringParams.assetId) {
      handle.setAssetId(value);
      return;
    }
    if (isFurnitureRibbonKey(commandKey)) {
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

/** Type guard used by `useRibbonCommands` composer (no furniture visibility keys). */
export function isFurniturePanelVisibilityKey(_visibilityKey: string): boolean {
  return false;
}

/** Exposed so the action interceptor can recognise furniture actions. */
export const FURNITURE_BRIDGE_ACTIONS = FURNITURE_RIBBON_KEYS_ACTIONS;
