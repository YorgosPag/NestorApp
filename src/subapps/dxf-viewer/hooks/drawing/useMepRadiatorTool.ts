/**
 * ADR-408 Εύρος Β #1 — Heating Radiator Tool React Hook Orchestrator.
 *
 * Single-click placement (Revit family placement): idle → awaitingPosition →
 * committed → awaitingPosition (continuous). ESC resets (EscapeCommandBus).
 *
 * ADR-600: the invariant placement FSM lives in `createSingleClickPlacementTool`;
 * this file is the thin per-entity config (builders + status + 3D event + bridge
 * publish). Public API byte-identical.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-600-single-click-placement-tool-ssot.md
 */

import { useEffect } from 'react';
import {
  buildDefaultMepRadiatorParams,
  buildMepRadiatorEntity,
  type MepRadiatorParamOverrides,
  type SceneUnits,
} from './mep-radiator-completion';
import { computeMepRadiatorGeometry } from '../../bim/mep-radiators/mep-radiator-geometry';
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import { mepRadiatorToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-radiator-tool-bridge-store';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
} from './create-single-click-placement-tool';

export type MepRadiatorToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface MepRadiatorToolState {
  readonly phase: MepRadiatorToolPhase;
  readonly overrides: MepRadiatorParamOverrides;
  readonly error: string | null;
}

export interface UseMepRadiatorToolOptions {
  readonly onMepRadiatorCreated?: (entity: MepRadiatorEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

// ADR-600 — the result contract IS the factory core type (no re-declaration).
export type UseMepRadiatorToolResult = CorePlacementResult<
  MepRadiatorToolState,
  MepRadiatorParamOverrides
>;

const useMepRadiatorPlacement = createSingleClickPlacementTool<
  MepRadiatorEntity,
  ReturnType<typeof buildDefaultMepRadiatorParams>,
  MepRadiatorParamOverrides,
  Record<string, never>,
  Record<string, never>,
  SceneUnits
>({
  defaultSceneUnits: 'mm',
  buildParams: (pt, overrides, units) => buildDefaultMepRadiatorParams(pt, overrides, units),
  buildEntity: (params, levelId) => buildMepRadiatorEntity(params, levelId),
  computeFootprint: (params) => computeMepRadiatorGeometry(params).footprint.vertices,
  place3dEvent: 'bim:place-mep-radiator-3d',
  getStatusText: (s) => (s.phase === 'awaitingPosition' ? 'tools.mepRadiator.statusPosition' : ''),
  useExtension: ({ state, isActive, setParamOverrides, getSceneUnits }) => {
    // Publish handle to the ribbon/3D bridge (single-writer, mirror manifold).
    useEffect(() => {
      mepRadiatorToolBridgeStore.set({
        isActive,
        kind: 'panel-radiator',
        overrides: state.overrides,
        setParamOverrides,
        getSceneUnits,
      });
      return () => {
        if (mepRadiatorToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
          mepRadiatorToolBridgeStore.set(null);
        }
      };
    }, [state, isActive, setParamOverrides, getSceneUnits]);
    return {};
  },
});

export function useMepRadiatorTool(
  options: UseMepRadiatorToolOptions = {},
): UseMepRadiatorToolResult {
  return useMepRadiatorPlacement({
    onCreated: options.onMepRadiatorCreated,
    currentLevelId: options.currentLevelId,
    getSceneUnits: options.getSceneUnits,
  });
}
