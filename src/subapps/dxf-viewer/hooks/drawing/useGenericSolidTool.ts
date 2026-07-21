/**
 * ADR-684 Φ3 — Generic-solid Tool React Hook Orchestrator.
 *
 * Single-click placement (Revit «Generic Model / Mass» · C4D `Add → primitive`):
 * idle → awaitingPosition → committed → awaitingPosition (continuous). ESC resets.
 *
 * ADR-600: the invariant placement FSM lives in `createSingleClickPlacementTool`;
 * this file is the thin per-entity config. The generic-solid tool carries one extra
 * state field — the chosen `shape` (GenericSolidShape discriminated union, default
 * box 500³) — merged into the commit/ghost overrides via `resolveCommitOverrides`
 * and exposed through the `useExtension` escape hatch (`setShape` + bridge publish).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
 * @see docs/centralized-systems/reference/adrs/ADR-600-single-click-placement-tool-ssot.md
 * @see hooks/drawing/useFurnitureTool.ts — the closest sibling
 */

import { useCallback, useEffect } from 'react';
import {
  buildDefaultGenericSolidParams,
  buildGenericSolidEntity,
  type GenericSolidParamOverrides,
  type SceneUnits,
} from './generic-solid-completion';
import { computeGenericSolidGeometry } from '../../bim/entities/generic-solid/generic-solid-geometry';
import {
  DEFAULT_GENERIC_SOLID_SHAPE,
  type GenericSolidEntity,
  type GenericSolidShape,
} from '../../bim/entities/generic-solid/generic-solid-types';
import { genericSolidToolBridgeStore } from '../../ui/ribbon/hooks/bridge/generic-solid-tool-bridge-store';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
} from './create-single-click-placement-tool';

export type GenericSolidToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface GenericSolidToolState {
  readonly phase: GenericSolidToolPhase;
  readonly shape: GenericSolidShape;
  readonly overrides: GenericSolidParamOverrides;
  readonly error: string | null;
}

export interface UseGenericSolidToolOptions {
  readonly onGenericSolidCreated?: (entity: GenericSolidEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

interface GenericSolidShapeApi {
  setShape(shape: GenericSolidShape): void;
}

// ADR-600 — the result contract IS the factory core type + the shape setter.
export type UseGenericSolidToolResult = CorePlacementResult<
  GenericSolidToolState,
  GenericSolidParamOverrides
> &
  GenericSolidShapeApi;

const useGenericSolidPlacement = createSingleClickPlacementTool<
  GenericSolidEntity,
  ReturnType<typeof buildDefaultGenericSolidParams>,
  GenericSolidParamOverrides,
  { shape: GenericSolidShape },
  GenericSolidShapeApi,
  SceneUnits
>({
  defaultSceneUnits: 'mm',
  initialExtra: { shape: DEFAULT_GENERIC_SOLID_SHAPE },
  buildParams: (pt, overrides, units) => buildDefaultGenericSolidParams(pt, overrides, units),
  buildEntity: (params, levelId) => buildGenericSolidEntity(params, levelId),
  computeFootprint: (params) => computeGenericSolidGeometry(params).footprint.vertices,
  resolveCommitOverrides: (s) => ({ ...s.overrides, shape: s.shape }),
  place3dEvent: 'bim:place-generic-solid-3d',
  getStatusText: (s) => (s.phase === 'awaitingPosition' ? 'tools.genericSolid.statusPosition' : ''),
  useExtension: ({ state, isActive, setState, setParamOverrides, getSceneUnits }) => {
    const setShape = useCallback(
      (shape: GenericSolidShape) => setState((prev) => ({ ...prev, shape, error: null })),
      [setState],
    );

    // Publish handle to the ribbon/3D bridge (single-writer, mirror furniture).
    useEffect(() => {
      genericSolidToolBridgeStore.set({
        isActive,
        shape: state.shape,
        overrides: state.overrides,
        setShape,
        setParamOverrides,
        getSceneUnits,
      });
      return () => {
        if (genericSolidToolBridgeStore.get()?.setShape === setShape) {
          genericSolidToolBridgeStore.set(null);
        }
      };
    }, [state, isActive, setShape, setParamOverrides, getSceneUnits]);

    return { setShape };
  },
});

export function useGenericSolidTool(
  options: UseGenericSolidToolOptions = {},
): UseGenericSolidToolResult {
  return useGenericSolidPlacement({
    onCreated: options.onGenericSolidCreated,
    currentLevelId: options.currentLevelId,
    getSceneUnits: options.getSceneUnits,
  });
}
