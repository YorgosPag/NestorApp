/**
 * ADR-406 — MEP Fixture Tool React Hook Orchestrator.
 *
 * Single-click placement (Revit/ArchiCAD family placement): idle → awaitingPosition
 * → committed → awaitingPosition (continuous). ESC resets (EscapeCommandBus).
 *
 * ADR-600: the invariant placement FSM lives in `createSingleClickPlacementTool`;
 * this file is the thin per-entity config. The richest member — it carries TWO
 * extra state fields (`shape` + the ADR-411 CC0 mesh `assetId`) merged into the
 * commit/ghost overrides via `resolveCommitOverrides`, a per-kind status dispatch,
 * and `setShape`/`setAssetId` + bridge publish via the `useExtension` escape hatch.
 * Public API byte-identical.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 * @see docs/centralized-systems/reference/adrs/ADR-600-single-click-placement-tool-ssot.md
 */

import { useCallback, useEffect } from 'react';
import {
  buildDefaultMepFixtureParams,
  buildMepFixtureEntity,
  type MepFixtureParamOverrides,
  type SceneUnits,
} from './mep-fixture-completion';
import { computeMepFixtureGeometry } from '../../bim/mep-fixtures/mep-fixture-geometry';
import type { MepFixtureEntity, MepFixtureShape } from '../../bim/types/mep-fixture-types';
import { isSanitaryKind } from '../../bim/sanitary/sanitary-symbol-spec';
import { isSocketKind } from '../../bim/mep-fixtures/socket-symbol-spec';
import { isDataOutletKind } from '../../bim/mep-fixtures/data-outlet-symbol-spec';
import { isAirTerminalKind } from '../../bim/mep-fixtures/air-terminal-symbol-spec';
import { isAhuKind } from '../../bim/mep-fixtures/ahu-symbol-spec';
import { isSprinklerKind } from '../../bim/mep-fixtures/sprinkler-symbol-spec';
import { isFireRiserKind } from '../../bim/mep-fixtures/fire-riser-symbol-spec';
import { isGasMeterKind } from '../../bim/mep-fixtures/gas-meter-symbol-spec';
import { isGasCookerKind } from '../../bim/mep-fixtures/gas-cooker-symbol-spec';
import { mepFixtureToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-fixture-tool-bridge-store';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
} from './create-single-click-placement-tool';

export type MepFixtureToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface MepFixtureToolState {
  readonly phase: MepFixtureToolPhase;
  readonly shape: MepFixtureShape;
  /** ADR-411 — chosen CC0 mesh asset (`''` ⇒ parametric fixture). */
  readonly assetId: string;
  readonly overrides: MepFixtureParamOverrides;
  readonly error: string | null;
}

export interface UseMepFixtureToolOptions {
  readonly onMepFixtureCreated?: (entity: MepFixtureEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

interface MepFixtureShapeAssetApi {
  setShape(shape: MepFixtureShape): void;
  /** ADR-411 — pick a library mesh (`''` ⇒ parametric). */
  setAssetId(assetId: string): void;
}

// ADR-600 — the result contract IS the factory core type + the shape/asset setters.
export type UseMepFixtureToolResult = CorePlacementResult<
  MepFixtureToolState,
  MepFixtureParamOverrides
> &
  MepFixtureShapeAssetApi;

const useMepFixturePlacement = createSingleClickPlacementTool<
  MepFixtureEntity,
  ReturnType<typeof buildDefaultMepFixtureParams>,
  MepFixtureParamOverrides,
  { shape: MepFixtureShape; assetId: string },
  MepFixtureShapeAssetApi,
  SceneUnits
>({
  defaultSceneUnits: 'mm',
  initialExtra: { shape: 'rectangular', assetId: '' },
  buildParams: (pt, overrides, units) => buildDefaultMepFixtureParams(pt, overrides, units),
  buildEntity: (params, levelId) => buildMepFixtureEntity(params, levelId),
  computeFootprint: (params) => computeMepFixtureGeometry(params).footprint.vertices,
  resolveCommitOverrides: (s) => ({
    ...s.overrides,
    shape: s.shape,
    ...(s.assetId ? { assetId: s.assetId } : {}),
  }),
  place3dEvent: 'bim:place-mep-fixture-3d',
  getStatusText: (s) => {
    if (s.phase !== 'awaitingPosition') return '';
    const { kind } = s.overrides;
    // ADR-408 Φ14 — the floor drain (σιφώνι) + sanitary terminals show their own prompts.
    if (kind === 'floor-drain') return 'tools.mepFloorDrain.statusPosition';
    if (kind && isSanitaryKind(kind)) return 'tools.mepSanitaryFixture.statusPosition';
    // ADR-430 — the socket (πρίζα).
    if (kind && isSocketKind(kind)) return 'tools.mepSocket.statusPosition';
    // ADR-431 — the data outlet (πρίζα δικτύου).
    if (kind && isDataOutletKind(kind)) return 'tools.mepDataOutlet.statusPosition';
    // ADR-432 — the air terminal (στόμιο) + AHU (ΚΚΜ).
    if (kind && isAirTerminalKind(kind)) return 'tools.mepAirTerminal.statusPosition';
    if (kind && isAhuKind(kind)) return 'tools.mepAhu.statusPosition';
    // ADR-433 — the sprinkler head (καταιονητήρας) + fire riser (στήλη).
    if (kind && isSprinklerKind(kind)) return 'tools.mepSprinkler.statusPosition';
    if (kind && isFireRiserKind(kind)) return 'tools.mepFireRiser.statusPosition';
    // ADR-434 — the gas meter (μετρητής αερίου) + gas cooker (εστία).
    if (kind && isGasMeterKind(kind)) return 'tools.mepGasMeter.statusPosition';
    if (kind && isGasCookerKind(kind)) return 'tools.mepGasCooker.statusPosition';
    return 'tools.mepFixture.statusPosition';
  },
  useExtension: ({ state, isActive, setState, setParamOverrides, getSceneUnits }) => {
    const setShape = useCallback(
      (shape: MepFixtureShape) => setState((prev) => ({ ...prev, shape, error: null })),
      [setState],
    );
    const setAssetId = useCallback(
      (assetId: string) => setState((prev) => ({ ...prev, assetId, error: null })),
      [setState],
    );

    // Publish handle to the ribbon/3D bridge (single-writer, mirror column).
    useEffect(() => {
      mepFixtureToolBridgeStore.set({
        isActive,
        // ADR-408 Φ14 — reflect the ACTIVE kind preset (light-fixture vs floor-drain)
        // so the 2D/3D placement ghosts symbol + colour correctly.
        kind: state.overrides.kind ?? 'light-fixture',
        shape: state.shape,
        assetId: state.assetId,
        overrides: state.overrides,
        setShape,
        setAssetId,
        setParamOverrides,
        getSceneUnits,
      });
      return () => {
        if (mepFixtureToolBridgeStore.get()?.setShape === setShape) {
          mepFixtureToolBridgeStore.set(null);
        }
      };
    }, [state, isActive, setShape, setAssetId, setParamOverrides, getSceneUnits]);

    return { setShape, setAssetId };
  },
});

export function useMepFixtureTool(options: UseMepFixtureToolOptions = {}): UseMepFixtureToolResult {
  return useMepFixturePlacement({
    onCreated: options.onMepFixtureCreated,
    currentLevelId: options.currentLevelId,
    getSceneUnits: options.getSceneUnits,
  });
}
