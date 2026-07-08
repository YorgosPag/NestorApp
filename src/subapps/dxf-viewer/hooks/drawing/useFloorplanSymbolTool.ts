/**
 * ADR-415 — Floorplan Symbol Tool React Hook Orchestrator.
 *
 * Single-click placement (Revit/ArchiCAD family placement): idle → awaitingPosition
 * → committed → awaitingPosition (continuous). The ribbon picker chooses WHICH
 * symbol (catalog) + rotation. ESC resets.
 *
 * ADR-600: the invariant placement FSM lives in `createSingleClickPlacementTool`;
 * this file is the thin per-entity config. Carries an extra `assetId` (merged into
 * the commit/ghost overrides) + exposes `setAssetId` and the picker bridge via the
 * `useExtension` escape hatch. It has NO 3D placement bridge (`place3dEvent`
 * omitted) — a 2D-only symbol. Public API byte-identical.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 * @see docs/centralized-systems/reference/adrs/ADR-600-single-click-placement-tool-ssot.md
 */

import { useCallback, useEffect } from 'react';
import {
  buildDefaultFloorplanSymbolParams,
  buildFloorplanSymbolEntity,
  type FloorplanSymbolParamOverrides,
  type SceneUnits,
} from './floorplan-symbol-completion';
import { computeFloorplanSymbolGeometry } from '../../bim/floorplan-symbols/floorplan-symbol-geometry';
import { DEFAULT_FLOORPLAN_SYMBOL_ASSET_ID } from '../../bim/floorplan-symbols/floorplan-symbol-catalog';
import type { FloorplanSymbolEntity } from '../../bim/types/floorplan-symbol-types';
import { floorplanSymbolToolBridgeStore } from '../../ui/ribbon/hooks/bridge/floorplan-symbol-tool-bridge-store';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
} from './create-single-click-placement-tool';

export type FloorplanSymbolToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface FloorplanSymbolToolState {
  readonly phase: FloorplanSymbolToolPhase;
  readonly assetId: string;
  readonly overrides: FloorplanSymbolParamOverrides;
  readonly error: string | null;
}

export interface UseFloorplanSymbolToolOptions {
  readonly onFloorplanSymbolCreated?: (entity: FloorplanSymbolEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

interface FloorplanSymbolAssetApi {
  setAssetId(assetId: string): void;
}

// ADR-600 — the result contract IS the factory core type + the symbol asset setter.
export type UseFloorplanSymbolToolResult = CorePlacementResult<
  FloorplanSymbolToolState,
  FloorplanSymbolParamOverrides
> &
  FloorplanSymbolAssetApi;

const useFloorplanSymbolPlacement = createSingleClickPlacementTool<
  FloorplanSymbolEntity,
  ReturnType<typeof buildDefaultFloorplanSymbolParams>,
  FloorplanSymbolParamOverrides,
  { assetId: string },
  FloorplanSymbolAssetApi,
  SceneUnits
>({
  defaultSceneUnits: 'mm',
  initialExtra: { assetId: DEFAULT_FLOORPLAN_SYMBOL_ASSET_ID },
  buildParams: (pt, overrides, units) => buildDefaultFloorplanSymbolParams(pt, overrides, units),
  buildEntity: (params, levelId) => buildFloorplanSymbolEntity(params, levelId),
  computeFootprint: (params) => computeFloorplanSymbolGeometry(params).footprint.vertices,
  resolveCommitOverrides: (s) => ({ ...s.overrides, assetId: s.assetId }),
  getStatusText: (s) => (s.phase === 'awaitingPosition' ? 'tools.floorplanSymbol.statusPosition' : ''),
  useExtension: ({ state, isActive, setState, setParamOverrides }) => {
    const setAssetId = useCallback(
      (assetId: string) => setState((prev) => ({ ...prev, assetId, error: null })),
      [setState],
    );

    // Publish handle to the ribbon picker (single-writer, mirror furniture).
    useEffect(() => {
      floorplanSymbolToolBridgeStore.set({
        isActive,
        assetId: state.assetId,
        overrides: state.overrides,
        setAssetId,
        setParamOverrides,
      });
      return () => {
        if (floorplanSymbolToolBridgeStore.get()?.setAssetId === setAssetId) {
          floorplanSymbolToolBridgeStore.set(null);
        }
      };
    }, [state, isActive, setAssetId, setParamOverrides]);

    return { setAssetId };
  },
});

export function useFloorplanSymbolTool(
  options: UseFloorplanSymbolToolOptions = {},
): UseFloorplanSymbolToolResult {
  return useFloorplanSymbolPlacement({
    onCreated: options.onFloorplanSymbolCreated,
    currentLevelId: options.currentLevelId,
    getSceneUnits: options.getSceneUnits,
  });
}
