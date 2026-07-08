/**
 * ADR-408 Εύρος Β #2 — Heating Boiler Tool React Hook Orchestrator.
 *
 * Single-click placement (Revit family placement): idle → awaitingPosition →
 * committed → awaitingPosition (continuous). ESC resets (EscapeCommandBus).
 *
 * ADR-600: the invariant placement FSM lives in `createSingleClickPlacementTool`;
 * this file is the thin per-entity config. The boiler adds one extra getter —
 * `getGhostSymbol` — via the `useExtension` escape hatch, sharing the SAME params
 * resolution as `getGhostFootprint` so the placement ghost stays byte-for-byte
 * WYSIWYG with the committed entity. Public API byte-identical.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-600-single-click-placement-tool-ssot.md
 */

import { useCallback, useEffect } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import {
  buildDefaultMepBoilerParams,
  buildMepBoilerEntity,
  type MepBoilerParamOverrides,
  type SceneUnits,
} from './mep-boiler-completion';
import { computeMepBoilerGeometry } from '../../bim/mep-boilers/mep-boiler-geometry';
import { buildMepBoilerSymbol, type BoilerSymbolGeometry } from '../../bim/mep-boilers/mep-boiler-symbol';
import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
import { mepBoilerToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-boiler-tool-bridge-store';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
} from './create-single-click-placement-tool';

export type MepBoilerToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface MepBoilerToolState {
  readonly phase: MepBoilerToolPhase;
  readonly overrides: MepBoilerParamOverrides;
  readonly error: string | null;
}

export interface UseMepBoilerToolOptions {
  readonly onMepBoilerCreated?: (entity: MepBoilerEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

interface MepBoilerGhostSymbolApi {
  /**
   * Full 2D symbol preview at `cursorPos` (connector stubs + flue vent + divider/
   * flame glyph), or null when not awaiting a position. Built from the SAME
   * `buildMepBoilerSymbol` SSoT the placed renderer uses. Pure projection (ADR-040).
   */
  getGhostSymbol(cursorPos: Readonly<Point2D> | null): BoilerSymbolGeometry | null;
}

// ADR-600 — the result contract IS the factory core type + the boiler's ghost-symbol getter.
export type UseMepBoilerToolResult = CorePlacementResult<
  MepBoilerToolState,
  MepBoilerParamOverrides
> &
  MepBoilerGhostSymbolApi;

const useMepBoilerPlacement = createSingleClickPlacementTool<
  MepBoilerEntity,
  ReturnType<typeof buildDefaultMepBoilerParams>,
  MepBoilerParamOverrides,
  Record<string, never>,
  MepBoilerGhostSymbolApi,
  SceneUnits
>({
  defaultSceneUnits: 'mm',
  buildParams: (pt, overrides, units) => buildDefaultMepBoilerParams(pt, overrides, units),
  buildEntity: (params, levelId) => buildMepBoilerEntity(params, levelId),
  computeFootprint: (params) => computeMepBoilerGeometry(params).footprint.vertices,
  place3dEvent: 'bim:place-mep-boiler-3d',
  getStatusText: (s) => (s.phase === 'awaitingPosition' ? 'tools.mepBoiler.statusPosition' : ''),
  useExtension: ({ state, isActive, setParamOverrides, getSceneUnits, getState }) => {
    // Publish handle to the ribbon/3D bridge (single-writer, mirror radiator).
    useEffect(() => {
      mepBoilerToolBridgeStore.set({
        isActive,
        kind: 'wall-boiler',
        overrides: state.overrides,
        setParamOverrides,
        getSceneUnits,
      });
      return () => {
        if (mepBoilerToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
          mepBoilerToolBridgeStore.set(null);
        }
      };
    }, [state, isActive, setParamOverrides, getSceneUnits]);

    const getGhostSymbol = useCallback(
      (cursorPos: Readonly<Point2D> | null): BoilerSymbolGeometry | null => {
        const s = getState();
        if (s.phase !== 'awaitingPosition' || cursorPos === null) return null;
        const params = buildDefaultMepBoilerParams(cursorPos, s.overrides, getSceneUnits());
        return buildMepBoilerSymbol(params, computeMepBoilerGeometry(params));
      },
      [getState, getSceneUnits],
    );

    return { getGhostSymbol };
  },
});

export function useMepBoilerTool(
  options: UseMepBoilerToolOptions = {},
): UseMepBoilerToolResult {
  return useMepBoilerPlacement({
    onCreated: options.onMepBoilerCreated,
    currentLevelId: options.currentLevelId,
    getSceneUnits: options.getSceneUnits,
  });
}
