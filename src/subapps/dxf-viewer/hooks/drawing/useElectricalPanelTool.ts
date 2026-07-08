/**
 * ADR-408 Φ3 — Electrical Panel Tool React Hook Orchestrator.
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
  buildDefaultElectricalPanelParams,
  buildElectricalPanelEntity,
  type ElectricalPanelParamOverrides,
  type SceneUnits,
} from './electrical-panel-completion';
import { computeElectricalPanelGeometry } from '../../bim/electrical-panels/electrical-panel-geometry';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import { electricalPanelToolBridgeStore } from '../../ui/ribbon/hooks/bridge/electrical-panel-tool-bridge-store';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
} from './create-single-click-placement-tool';

export type ElectricalPanelToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface ElectricalPanelToolState {
  readonly phase: ElectricalPanelToolPhase;
  readonly overrides: ElectricalPanelParamOverrides;
  readonly error: string | null;
}

export interface UseElectricalPanelToolOptions {
  readonly onElectricalPanelCreated?: (entity: ElectricalPanelEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

// ADR-600 — the result contract IS the factory core type (no re-declaration).
export type UseElectricalPanelToolResult = CorePlacementResult<
  ElectricalPanelToolState,
  ElectricalPanelParamOverrides
>;

const useElectricalPanelPlacement = createSingleClickPlacementTool<
  ElectricalPanelEntity,
  ReturnType<typeof buildDefaultElectricalPanelParams>,
  ElectricalPanelParamOverrides,
  Record<string, never>,
  Record<string, never>,
  SceneUnits
>({
  defaultSceneUnits: 'mm',
  buildParams: (pt, overrides, units) => buildDefaultElectricalPanelParams(pt, overrides, units),
  buildEntity: (params, levelId) => buildElectricalPanelEntity(params, levelId),
  computeFootprint: (params) => computeElectricalPanelGeometry(params).footprint.vertices,
  place3dEvent: 'bim:place-electrical-panel-3d',
  getStatusText: (s) => {
    if (s.phase !== 'awaitingPosition') return '';
    // ADR-431 — the comms-rack shows its own placement prompt.
    return s.overrides.kind === 'comms-rack'
      ? 'tools.commsRack.statusPosition'
      : 'tools.electricalPanel.statusPosition';
  },
  useExtension: ({ state, isActive, setParamOverrides, getSceneUnits }) => {
    // Publish handle to the ribbon/3D bridge (single-writer, mirror fixture).
    useEffect(() => {
      electricalPanelToolBridgeStore.set({
        isActive,
        // ADR-431 — reflect the active kind so the contextual ribbon tab knows whether
        // it is editing a distribution board or a comms-rack.
        kind: state.overrides.kind ?? 'distribution-board',
        overrides: state.overrides,
        setParamOverrides,
        getSceneUnits,
      });
      return () => {
        if (electricalPanelToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
          electricalPanelToolBridgeStore.set(null);
        }
      };
    }, [state, isActive, setParamOverrides, getSceneUnits]);
    return {};
  },
});

export function useElectricalPanelTool(
  options: UseElectricalPanelToolOptions = {},
): UseElectricalPanelToolResult {
  return useElectricalPanelPlacement({
    onCreated: options.onElectricalPanelCreated,
    currentLevelId: options.currentLevelId,
    getSceneUnits: options.getSceneUnits,
  });
}
