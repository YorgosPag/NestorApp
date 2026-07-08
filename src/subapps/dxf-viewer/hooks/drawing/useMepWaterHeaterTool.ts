/**
 * ADR-408 — Water Heater Tool React Hook Orchestrator.
 *
 * Single-click placement (Revit family placement): idle → awaitingPosition →
 * committed → awaitingPosition (continuous). ESC resets (EscapeCommandBus).
 *
 * ADR-600: the invariant placement FSM lives in `createSingleClickPlacementTool`;
 * this file is the thin per-entity config. Public API byte-identical.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-600-single-click-placement-tool-ssot.md
 */

import { useEffect } from 'react';
import {
  buildDefaultMepWaterHeaterParams,
  buildMepWaterHeaterEntity,
  type MepWaterHeaterParamOverrides,
  type SceneUnits,
} from './mep-water-heater-completion';
import { computeMepWaterHeaterGeometry } from '../../bim/mep-water-heaters/mep-water-heater-geometry';
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import { mepWaterHeaterToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-water-heater-tool-bridge-store';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
} from './create-single-click-placement-tool';

export type MepWaterHeaterToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface MepWaterHeaterToolState {
  readonly phase: MepWaterHeaterToolPhase;
  readonly overrides: MepWaterHeaterParamOverrides;
  readonly error: string | null;
}

export interface UseMepWaterHeaterToolOptions {
  readonly onMepWaterHeaterCreated?: (entity: MepWaterHeaterEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

// ADR-600 — the result contract IS the factory core type (no re-declaration).
export type UseMepWaterHeaterToolResult = CorePlacementResult<
  MepWaterHeaterToolState,
  MepWaterHeaterParamOverrides
>;

const useMepWaterHeaterPlacement = createSingleClickPlacementTool<
  MepWaterHeaterEntity,
  ReturnType<typeof buildDefaultMepWaterHeaterParams>,
  MepWaterHeaterParamOverrides,
  Record<string, never>,
  Record<string, never>,
  SceneUnits
>({
  defaultSceneUnits: 'mm',
  buildParams: (pt, overrides, units) => buildDefaultMepWaterHeaterParams(pt, overrides, units),
  buildEntity: (params, levelId) => buildMepWaterHeaterEntity(params, levelId),
  computeFootprint: (params) => computeMepWaterHeaterGeometry(params).footprint.vertices,
  place3dEvent: 'bim:place-mep-water-heater-3d',
  getStatusText: (s) => (s.phase === 'awaitingPosition' ? 'tools.mepWaterHeater.statusPosition' : ''),
  useExtension: ({ state, isActive, setParamOverrides, getSceneUnits }) => {
    // Publish handle to the ribbon/3D bridge (single-writer, mirror boiler).
    useEffect(() => {
      mepWaterHeaterToolBridgeStore.set({
        isActive,
        kind: 'electric-water-heater',
        overrides: state.overrides,
        setParamOverrides,
        getSceneUnits,
      });
      return () => {
        if (mepWaterHeaterToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
          mepWaterHeaterToolBridgeStore.set(null);
        }
      };
    }, [state, isActive, setParamOverrides, getSceneUnits]);
    return {};
  },
});

export function useMepWaterHeaterTool(
  options: UseMepWaterHeaterToolOptions = {},
): UseMepWaterHeaterToolResult {
  return useMepWaterHeaterPlacement({
    onCreated: options.onMepWaterHeaterCreated,
    currentLevelId: options.currentLevelId,
    getSceneUnits: options.getSceneUnits,
  });
}
