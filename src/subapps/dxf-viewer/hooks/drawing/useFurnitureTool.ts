/**
 * ADR-410 — Furniture Tool React Hook Orchestrator.
 *
 * Single-click placement (Revit/ArchiCAD family placement): idle → awaitingPosition
 * → committed → awaitingPosition (continuous). ESC resets (EscapeCommandBus).
 *
 * ADR-600: the invariant placement FSM lives in `createSingleClickPlacementTool`;
 * this file is the thin per-entity config. The furniture tool carries one extra
 * state field — the chosen CC0 mesh `assetId` — merged into the commit/ghost
 * overrides via `resolveCommitOverrides` and exposed through the `useExtension`
 * escape hatch (`setAssetId` + bridge publish). Public API byte-identical.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 * @see docs/centralized-systems/reference/adrs/ADR-600-single-click-placement-tool-ssot.md
 */

import { useCallback, useEffect } from 'react';
import {
  buildDefaultFurnitureParams,
  buildFurnitureEntity,
  type FurnitureParamOverrides,
  type SceneUnits,
} from './furniture-completion';
import { computeFurnitureGeometry } from '../../bim/furniture/furniture-geometry';
import { DEFAULT_FURNITURE_ASSET_ID, resolveFurnitureAsset } from '../../bim/furniture/furniture-catalog';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import { furnitureToolBridgeStore } from '../../ui/ribbon/hooks/bridge/furniture-tool-bridge-store';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
} from './create-single-click-placement-tool';

export type FurnitureToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface FurnitureToolState {
  readonly phase: FurnitureToolPhase;
  readonly assetId: string;
  readonly overrides: FurnitureParamOverrides;
  readonly error: string | null;
}

export interface UseFurnitureToolOptions {
  readonly onFurnitureCreated?: (entity: FurnitureEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

interface FurnitureAssetApi {
  setAssetId(assetId: string): void;
}

// ADR-600 — the result contract IS the factory core type + the furniture asset setter.
export type UseFurnitureToolResult = CorePlacementResult<
  FurnitureToolState,
  FurnitureParamOverrides
> &
  FurnitureAssetApi;

const useFurniturePlacement = createSingleClickPlacementTool<
  FurnitureEntity,
  ReturnType<typeof buildDefaultFurnitureParams>,
  FurnitureParamOverrides,
  { assetId: string },
  FurnitureAssetApi,
  SceneUnits
>({
  defaultSceneUnits: 'mm',
  initialExtra: { assetId: DEFAULT_FURNITURE_ASSET_ID },
  buildParams: (pt, overrides, units) => buildDefaultFurnitureParams(pt, overrides, units),
  buildEntity: (params, levelId) => buildFurnitureEntity(params, levelId),
  computeFootprint: (params) => computeFurnitureGeometry(params).footprint.vertices,
  resolveCommitOverrides: (s) => ({ ...s.overrides, assetId: s.assetId }),
  place3dEvent: 'bim:place-furniture-3d',
  getStatusText: (s) => (s.phase === 'awaitingPosition' ? 'tools.furniture.statusPosition' : ''),
  useExtension: ({ state, isActive, setState, setParamOverrides, getSceneUnits }) => {
    const setAssetId = useCallback(
      (assetId: string) => setState((prev) => ({ ...prev, assetId, error: null })),
      [setState],
    );

    // Publish handle to the ribbon/3D bridge (single-writer, mirror mep-fixture).
    useEffect(() => {
      const kind = resolveFurnitureAsset(state.assetId)?.kind ?? 'chair';
      furnitureToolBridgeStore.set({
        isActive,
        kind,
        assetId: state.assetId,
        overrides: state.overrides,
        setAssetId,
        setParamOverrides,
        getSceneUnits,
      });
      return () => {
        if (furnitureToolBridgeStore.get()?.setAssetId === setAssetId) {
          furnitureToolBridgeStore.set(null);
        }
      };
    }, [state, isActive, setAssetId, setParamOverrides, getSceneUnits]);

    return { setAssetId };
  },
});

export function useFurnitureTool(options: UseFurnitureToolOptions = {}): UseFurnitureToolResult {
  return useFurniturePlacement({
    onCreated: options.onFurnitureCreated,
    currentLevelId: options.currentLevelId,
    getSceneUnits: options.getSceneUnits,
  });
}
