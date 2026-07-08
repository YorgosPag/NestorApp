/**
 * ADR-408 — MEP Manifold Tool React Hook Orchestrator.
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
  buildDefaultMepManifoldParams,
  buildMepManifoldEntity,
  type MepManifoldParamOverrides,
  type SceneUnits,
} from './mep-manifold-completion';
import { computeMepManifoldGeometry } from '../../bim/mep-manifolds/mep-manifold-geometry';
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import { mepManifoldToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-manifold-tool-bridge-store';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
} from './create-single-click-placement-tool';

export type MepManifoldToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface MepManifoldToolState {
  readonly phase: MepManifoldToolPhase;
  readonly overrides: MepManifoldParamOverrides;
  readonly error: string | null;
}

export interface UseMepManifoldToolOptions {
  readonly onMepManifoldCreated?: (entity: MepManifoldEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

// ADR-600 — the result contract IS the factory core type (no re-declaration).
export type UseMepManifoldToolResult = CorePlacementResult<
  MepManifoldToolState,
  MepManifoldParamOverrides
>;

const useMepManifoldPlacement = createSingleClickPlacementTool<
  MepManifoldEntity,
  ReturnType<typeof buildDefaultMepManifoldParams>,
  MepManifoldParamOverrides,
  Record<string, never>,
  Record<string, never>,
  SceneUnits
>({
  defaultSceneUnits: 'mm',
  buildParams: (pt, overrides, units) => buildDefaultMepManifoldParams(pt, overrides, units),
  buildEntity: (params, levelId) => buildMepManifoldEntity(params, levelId),
  computeFootprint: (params) => computeMepManifoldGeometry(params).footprint.vertices,
  place3dEvent: 'bim:place-mep-manifold-3d',
  getStatusText: (s) => (s.phase === 'awaitingPosition' ? 'tools.mepManifold.statusPosition' : ''),
  useExtension: ({ state, isActive, setParamOverrides, getSceneUnits }) => {
    // Publish handle to the ribbon/3D bridge (single-writer, mirror fixture).
    useEffect(() => {
      mepManifoldToolBridgeStore.set({
        isActive,
        // ADR-408 Φ14 — reflect the ACTIVE kind preset (drainage-collector vs
        // floor-manifold) so the 2D/3D placement ghosts colour + grate correctly.
        kind: state.overrides.kind ?? 'floor-manifold',
        overrides: state.overrides,
        setParamOverrides,
        getSceneUnits,
      });
      return () => {
        if (mepManifoldToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
          mepManifoldToolBridgeStore.set(null);
        }
      };
    }, [state, isActive, setParamOverrides, getSceneUnits]);
    return {};
  },
});

export function useMepManifoldTool(
  options: UseMepManifoldToolOptions = {},
): UseMepManifoldToolResult {
  return useMepManifoldPlacement({
    onCreated: options.onMepManifoldCreated,
    currentLevelId: options.currentLevelId,
    getSceneUnits: options.getSceneUnits,
  });
}
