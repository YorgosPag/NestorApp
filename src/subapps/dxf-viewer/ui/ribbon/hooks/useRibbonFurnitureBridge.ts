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

import { furnitureToolBridgeStore } from './bridge/furniture-tool-bridge-store';
import {
  FURNITURE_RIBBON_KEYS,
  FURNITURE_RIBBON_KEYS_ACTIONS,
} from './bridge/furniture-command-keys';
import { FURNITURE_CATALOG } from '../../../bim/furniture/furniture-catalog';
import { bimMeshThumbnailStore } from '../../../bim-3d/library/bim-mesh-library/bim-mesh-thumbnail-cache';
import type { RibbonEntityBridgeCore } from './ribbon-entity-bridge-shared';
import {
  useToolHandleBridge,
  useThumbnailPreload,
  buildMeshCatalogOptions,
} from './ribbon-tool-handle-bridge-shared';

/** BIM category → Storage library folder for furniture meshes. */
const FURNITURE_MESH_CATEGORY = 'furniture';

export type RibbonFurnitureBridge = RibbonEntityBridgeCore;

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

export function useRibbonFurnitureBridge(): RibbonFurnitureBridge {
  // Subscribe to the tool handle so the ribbon re-renders on tool state changes.
  const toolHandle = furnitureToolBridgeStore.use();
  // Subscribe to thumbnail resolution so the catalog dropdown re-renders with
  // preview images once Storage URLs resolve (ADR-410 picker thumbnails).
  const thumbVersion = bimMeshThumbnailStore.use();

  const isActive = !!toolHandle && toolHandle.isActive;
  useThumbnailPreload(isActive, FURNITURE_MESH_CATEGORY, FURNITURE_CATALOG.map((p) => p.id));

  return useToolHandleBridge({
    toolHandle,
    readImperative: () => furnitureToolBridgeStore.get(),
    assetIdKey: FURNITURE_RIBBON_KEYS.stringParams.assetId,
    buildOptions: () => buildMeshCatalogOptions(FURNITURE_CATALOG, FURNITURE_MESH_CATEGORY),
    numberKeyToField: NUMBER_KEY_TO_OVERRIDE,
    numberKeyDefault: NUMBER_KEY_DEFAULT,
    optionsDeps: [thumbVersion],
  });
}

/** Type guard used by `useRibbonCommands` composer (no furniture visibility keys). */
export function isFurniturePanelVisibilityKey(_visibilityKey: string): boolean {
  return false;
}

/** Exposed so the action interceptor can recognise furniture actions. */
export const FURNITURE_BRIDGE_ACTIONS = FURNITURE_RIBBON_KEYS_ACTIONS;
