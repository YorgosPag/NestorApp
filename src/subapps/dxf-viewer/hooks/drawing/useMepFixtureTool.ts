/**
 * ADR-406 — MEP Fixture Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingPosition → committed → awaitingPosition (continuous)
 *
 * Single-click placement (Revit/ArchiCAD family placement): user picks the
 * fixture tool → clicks to place at the cursor point → continuous chain. ESC
 * resets (handled centrally by EscapeCommandBus, like the column tool).
 *
 * SSoT alignment:
 *   - Entity build via `buildMepFixtureEntity` / `buildDefaultMepFixtureParams`
 *     (`hooks/drawing/mep-fixture-completion.ts`). ZERO duplicate construction.
 *   - 3D placement bridge via `bim:place-mep-fixture-3d` → same `onCanvasClick`.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  buildDefaultMepFixtureParams,
  buildMepFixtureEntity,
  type MepFixtureParamOverrides,
  type SceneUnits,
} from './mep-fixture-completion';
import {
  computeMepFixtureGeometry,
} from '../../bim/mep-fixtures/mep-fixture-geometry';
import type { MepFixtureEntity, MepFixtureShape } from '../../bim/types/mep-fixture-types';
import { isSanitaryKind } from '../../bim/sanitary/sanitary-symbol-spec';
import { isSocketKind } from '../../bim/mep-fixtures/socket-symbol-spec';
import { isDataOutletKind } from '../../bim/mep-fixtures/data-outlet-symbol-spec';
import { isAirTerminalKind } from '../../bim/mep-fixtures/air-terminal-symbol-spec';
import { isAhuKind } from '../../bim/mep-fixtures/ahu-symbol-spec';
import { mepFixtureToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-fixture-tool-bridge-store';
import { EventBus } from '../../systems/events/EventBus';

// ─── State machine types ─────────────────────────────────────────────────────

export type MepFixtureToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface MepFixtureToolState {
  readonly phase: MepFixtureToolPhase;
  readonly shape: MepFixtureShape;
  /** ADR-411 — chosen CC0 mesh asset (`''` ⇒ parametric fixture). */
  readonly assetId: string;
  readonly overrides: MepFixtureParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: MepFixtureToolState = {
  phase: 'idle',
  shape: 'rectangular',
  assetId: '',
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseMepFixtureToolOptions {
  readonly onMepFixtureCreated?: (entity: MepFixtureEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseMepFixtureToolResult {
  readonly state: MepFixtureToolState;
  activate(): void;
  setShape(shape: MepFixtureShape): void;
  /** ADR-411 — pick a library mesh (`''` ⇒ parametric). */
  setAssetId(assetId: string): void;
  setParamOverrides(overrides: MepFixtureParamOverrides): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new fixture. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  getStatusText(): string;
  /**
   * Footprint preview at `cursorPos` (world canvas units), or null when not
   * awaiting a position. Pure projection — no state mutation, no cursor-store
   * subscription (ADR-040). Consumed by the placement ghost leaf.
   */
  getGhostFootprint(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  readonly isActive: boolean;
  readonly isAwaitingPosition: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useMepFixtureTool(options: UseMepFixtureToolOptions = {}): UseMepFixtureToolResult {
  const { onMepFixtureCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<MepFixtureToolState>(INITIAL_STATE);
  const stateRef = useRef<MepFixtureToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onMepFixtureCreated);
  onCreatedRef.current = onMepFixtureCreated;

  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, shape: prev.shape, assetId: prev.assetId, overrides: prev.overrides, phase: 'awaitingPosition' }));
  }, []);

  const setShape = useCallback((shape: MepFixtureShape) => {
    setState((prev) => ({ ...prev, shape, error: null }));
  }, []);

  const setAssetId = useCallback((assetId: string) => {
    setState((prev) => ({ ...prev, assetId, error: null }));
  }, []);

  const setParamOverrides = useCallback((overrides: MepFixtureParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      shape: prev.shape,
      assetId: prev.assetId,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, []);

  const commitFromState = useCallback(
    (s: MepFixtureToolState, clickPoint: Readonly<Point2D>): boolean => {
      const overrides: MepFixtureParamOverrides = {
        ...s.overrides,
        shape: s.shape,
        ...(s.assetId ? { assetId: s.assetId } : {}),
      };
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultMepFixtureParams(clickPoint, overrides, sceneUnits);
      const result = buildMepFixtureEntity(params, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onCreatedRef.current?.(result.entity);
      setState({ ...INITIAL_STATE, shape: s.shape, assetId: s.assetId, overrides: s.overrides, phase: 'awaitingPosition' });
      return true;
    },
    [currentLevelId],
  );

  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition') return false;
      return commitFromState(s, point);
    },
    [commitFromState],
  );

  // 3D placement bridge — same commit path as the 2D click (zero duplication).
  const onCanvasClickRef = useRef(onCanvasClick);
  onCanvasClickRef.current = onCanvasClick;
  useEffect(() => {
    return EventBus.on('bim:place-mep-fixture-3d', ({ point }) => {
      onCanvasClickRef.current(point);
    });
  }, []);

  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.phase !== 'awaitingPosition') return '';
    // ADR-408 Φ14 — the floor drain (σιφώνι) + sanitary terminals show their own
    // placement prompts; the light fixture keeps the default.
    if (s.overrides.kind === 'floor-drain') return 'tools.mepFloorDrain.statusPosition';
    if (s.overrides.kind && isSanitaryKind(s.overrides.kind)) return 'tools.mepSanitaryFixture.statusPosition';
    // ADR-430 — the socket (πρίζα) shows its own placement prompt.
    if (s.overrides.kind && isSocketKind(s.overrides.kind)) return 'tools.mepSocket.statusPosition';
    // ADR-431 — the data outlet (πρίζα δικτύου) shows its own placement prompt.
    if (s.overrides.kind && isDataOutletKind(s.overrides.kind)) return 'tools.mepDataOutlet.statusPosition';
    // ADR-432 — the air terminal (στόμιο) + AHU (ΚΚΜ) show their own placement prompts.
    if (s.overrides.kind && isAirTerminalKind(s.overrides.kind)) return 'tools.mepAirTerminal.statusPosition';
    if (s.overrides.kind && isAhuKind(s.overrides.kind)) return 'tools.mepAhu.statusPosition';
    return 'tools.mepFixture.statusPosition';
  }, []);

  const getGhostFootprint = useCallback(
    (cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition' || cursorPos === null) return null;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultMepFixtureParams(
        cursorPos,
        { ...s.overrides, shape: s.shape, ...(s.assetId ? { assetId: s.assetId } : {}) },
        sceneUnits,
      );
      return computeMepFixtureGeometry(params).footprint.vertices;
    },
    [],
  );

  // Publish handle to the ribbon/3D bridge (single-writer, mirror column).
  useEffect(() => {
    const isActive = state.phase !== 'idle';
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
      getSceneUnits: () => getSceneUnitsRef.current?.() ?? 'mm',
    });
    return () => {
      if (mepFixtureToolBridgeStore.get()?.setShape === setShape) {
        mepFixtureToolBridgeStore.set(null);
      }
    };
  }, [state, setShape, setAssetId, setParamOverrides]);

  return {
    state,
    activate,
    setShape,
    setAssetId,
    setParamOverrides,
    deactivate,
    reset,
    onCanvasClick,
    getStatusText,
    getGhostFootprint,
    isActive: state.phase !== 'idle',
    isAwaitingPosition: state.phase === 'awaitingPosition',
  };
}
