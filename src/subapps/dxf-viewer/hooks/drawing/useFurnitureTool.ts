/**
 * ADR-410 — Furniture Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingPosition → committed → awaitingPosition (continuous)
 *
 * Single-click placement (Revit/ArchiCAD family placement): user picks the
 * furniture tool → clicks to place at the cursor point → continuous chain. ESC
 * resets (handled centrally by EscapeCommandBus, like the mep-fixture tool).
 *
 * SSoT alignment:
 *   - Entity build via `buildFurnitureEntity` / `buildDefaultFurnitureParams`
 *     (`hooks/drawing/furniture-completion.ts`). ZERO duplicate construction.
 *   - 3D placement bridge via `bim:place-furniture-3d` → same `onCanvasClick`.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
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
import { EventBus } from '../../systems/events/EventBus';

// ─── State machine types ─────────────────────────────────────────────────────

export type FurnitureToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface FurnitureToolState {
  readonly phase: FurnitureToolPhase;
  readonly assetId: string;
  readonly overrides: FurnitureParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: FurnitureToolState = {
  phase: 'idle',
  assetId: DEFAULT_FURNITURE_ASSET_ID,
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseFurnitureToolOptions {
  readonly onFurnitureCreated?: (entity: FurnitureEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseFurnitureToolResult {
  readonly state: FurnitureToolState;
  activate(): void;
  setAssetId(assetId: string): void;
  setParamOverrides(overrides: FurnitureParamOverrides): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new furniture item. */
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

export function useFurnitureTool(options: UseFurnitureToolOptions = {}): UseFurnitureToolResult {
  const { onFurnitureCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<FurnitureToolState>(INITIAL_STATE);
  const stateRef = useRef<FurnitureToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onFurnitureCreated);
  onCreatedRef.current = onFurnitureCreated;

  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, assetId: prev.assetId, overrides: prev.overrides, phase: 'awaitingPosition' }));
  }, []);

  const setAssetId = useCallback((assetId: string) => {
    setState((prev) => ({ ...prev, assetId, error: null }));
  }, []);

  const setParamOverrides = useCallback((overrides: FurnitureParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      assetId: prev.assetId,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, []);

  const commitFromState = useCallback(
    (s: FurnitureToolState, clickPoint: Readonly<Point2D>): boolean => {
      const overrides: FurnitureParamOverrides = { ...s.overrides, assetId: s.assetId };
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultFurnitureParams(clickPoint, overrides, sceneUnits);
      const result = buildFurnitureEntity(params, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onCreatedRef.current?.(result.entity);
      setState({ ...INITIAL_STATE, assetId: s.assetId, overrides: s.overrides, phase: 'awaitingPosition' });
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
    return EventBus.on('bim:place-furniture-3d', ({ point }) => {
      onCanvasClickRef.current(point);
    });
  }, []);

  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.phase === 'idle') return '';
    return s.phase === 'awaitingPosition' ? 'tools.furniture.statusPosition' : '';
  }, []);

  const getGhostFootprint = useCallback(
    (cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition' || cursorPos === null) return null;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultFurnitureParams(cursorPos, { ...s.overrides, assetId: s.assetId }, sceneUnits);
      return computeFurnitureGeometry(params).footprint.vertices;
    },
    [],
  );

  // Publish handle to the ribbon/3D bridge (single-writer, mirror mep-fixture).
  useEffect(() => {
    const isActive = state.phase !== 'idle';
    const kind = resolveFurnitureAsset(state.assetId)?.kind ?? 'chair';
    furnitureToolBridgeStore.set({
      isActive,
      kind,
      assetId: state.assetId,
      overrides: state.overrides,
      setAssetId,
      setParamOverrides,
      getSceneUnits: () => getSceneUnitsRef.current?.() ?? 'mm',
    });
    return () => {
      if (furnitureToolBridgeStore.get()?.setAssetId === setAssetId) {
        furnitureToolBridgeStore.set(null);
      }
    };
  }, [state, setAssetId, setParamOverrides]);

  return {
    state,
    activate,
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
