/**
 * ADR-600 — Single-click placement tool factory SSoT
 * (`createSingleClickPlacementTool`).
 *
 * The 8 Revit-family "click-to-place" tool hooks under `hooks/drawing/`
 * (`useMepRadiator/WaterHeater/Manifold/Boiler/Fixture` · `useElectricalPanel` ·
 * `useFurniture` · `useFloorplanSymbol` Tool) shared one ~150-line FSM verbatim:
 *
 *   idle → awaitingPosition → committed → awaitingPosition (continuous)
 *
 * with identical `state` triple + 3 refs + activate/deactivate/reset/
 * setParamOverrides + `commitFromState` (buildDefault{X}Params → build{X}Entity →
 * onCreated) + `onCanvasClick` phase-guard + `bim:place-*-3d` EventBus bridge +
 * `getStatusText` + `getGhostFootprint` (pure ADR-040 projection) + is{Active,
 * AwaitingPosition}. They differed ONLY in the entity builders/geometry, the
 * status keys, the optional 3D event, and each tool's bespoke extra state
 * (`assetId`/`shape`) + bridge-store publish + extra getters (`getGhostSymbol`).
 *
 * Big-player practice (a small required core + a single typed escape hatch, like
 * TanStack Query's `QueryObserver` options): the factory owns the invariant FSM;
 * `config` injects the builders + status + optional 3D event; a single
 * `useExtension` hook owns the per-tool extra state, its setters, the bridge
 * publish, and any extra getter — spread into the returned API. Extra state stays
 * INSIDE the tool state object, so the public `.state` shape is byte-identical.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-600-single-click-placement-tool-ssot.md
 * @see ADR-040 (micro-leaf: hook owns React state, ghost getters are pure projections)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import type { ColumnAnchor } from '../../bim/types/column-types';
import { EventBus } from '../../systems/events/EventBus';
import {
  setPlacementRotationLock,
  getPlacementRotationLock,
  clearPlacementRotationLock,
} from '../../systems/cursor/PlacementRotationStore';
import { resolveColumnRotationDeg } from '../../bim/columns/column-rotation';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';

// ─── Core FSM types ──────────────────────────────────────────────────────────

/**
 * `awaitingRotation` — optional 2-click «place→rotate» phase (ADR-514 Φ6d, mirror
 * `useColumnTool`): 1ο κλικ κλειδώνει θέση (`PlacementRotationStore`), 2ο ορίζει γωνία
 * → commit. Ενεργοποιείται ΜΟΝΟ όταν το `config.placeThenRotate` είναι παρόν (item 4).
 */
export type PlacementToolPhase = 'idle' | 'awaitingPosition' | 'awaitingRotation' | 'committed';

export interface CorePlacementState<TOverrides> {
  readonly phase: PlacementToolPhase;
  readonly overrides: TOverrides;
  readonly error: string | null;
}

/** The `bim:place-*-3d` EventBus keys the placement tools listen on (all `{point}`). */
export type PlacementPlaceEvent =
  | 'bim:place-mep-radiator-3d'
  | 'bim:place-mep-water-heater-3d'
  | 'bim:place-mep-manifold-3d'
  | 'bim:place-mep-boiler-3d'
  | 'bim:place-mep-fixture-3d'
  | 'bim:place-electrical-panel-3d'
  | 'bim:place-furniture-3d'
  | 'bim:place-generic-solid-3d';

/** `build{X}Entity` result contract — shared by every completion module. */
export type PlacementBuildResult<TEntity> =
  | { readonly ok: true; readonly entity: TEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

export interface PlacementToolOptions<TEntity, TUnits> {
  readonly onCreated?: (entity: TEntity) => void;
  readonly currentLevelId?: string;
  readonly getSceneUnits?: () => TUnits;
}

export interface CorePlacementResult<TState, TOverrides> {
  readonly state: TState;
  activate(): void;
  setParamOverrides(overrides: TOverrides): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new entity. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  getStatusText(): string;
  /** Footprint preview at `cursorPos` (world units) — pure projection (ADR-040). */
  getGhostFootprint(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  readonly isActive: boolean;
  readonly isAwaitingPosition: boolean;
}

// ─── Extension escape hatch ──────────────────────────────────────────────────

/**
 * Stable-reference context handed to a tool's `useExtension`. Owns nothing itself
 * — it exposes the core state + setters so the extension can add extra state
 * setters, publish its bespoke bridge store, and expose extra getters.
 */
export interface PlacementExtensionCtx<TState, TOverrides, TUnits> {
  /** Reactive current state (use in effect deps). */
  readonly state: TState;
  /** `phase !== 'idle'` — reactive. */
  readonly isActive: boolean;
  /** Event-time state read (stable). */
  getState(): TState;
  /** Functional state patch (stable identity — safe `useCallback` dep). */
  setState(updater: (prev: TState) => TState): void;
  /** Core param-overrides setter (stable — usable as a bridge dedupe key). */
  setParamOverrides(overrides: TOverrides): void;
  /** Resolve scene units (getter ?? default) — stable. */
  getSceneUnits(): TUnits;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface PlacementToolConfig<
  TEntity,
  TParams,
  TOverrides extends object,
  TExtra extends object,
  TApi extends object,
  TUnits extends string,
> {
  /** Fallback when `getSceneUnits` is absent (every caller: `'mm'`). */
  readonly defaultSceneUnits: TUnits;
  /** Extra state fields merged into the tool state (e.g. `{ assetId }`, `{ shape, assetId }`). */
  readonly initialExtra?: TExtra;
  buildParams(clickPoint: Readonly<Point2D>, overrides: TOverrides, sceneUnits: TUnits): TParams;
  buildEntity(params: TParams, levelId: string): PlacementBuildResult<TEntity>;
  computeFootprint(params: TParams): readonly Point3D[];
  /** Merge extra state into overrides for commit + ghost (default: `s.overrides`). */
  resolveCommitOverrides?(state: CorePlacementState<TOverrides> & TExtra): TOverrides;
  getStatusText(state: CorePlacementState<TOverrides> & TExtra): string;
  /** Omitted ⇒ no 3D placement bridge (floorplan symbol). */
  readonly place3dEvent?: PlacementPlaceEvent;
  /**
   * Optional 2-click «place→rotate» (ADR-514 Φ6d, mirror `useColumnTool`): 1ο κλικ
   * κλειδώνει θέση+anchor στο `PlacementRotationStore` (τόξο φοράς + πορτοκαλί γραμμή
   * ζωγραφίζονται ΑΥΤΟΜΑΤΑ από `drawing-hover-overlays.ts` — tool-agnostic, μη πειράξεις),
   * 2ο κλικ ορίζει τη γωνία από την κατεύθυνση κλειδωμένη-θέση→click. Omitted ⇒ κλασική
   * 1-click commit (backward-compat, καμία αλλαγή συμπεριφοράς).
   */
  readonly placeThenRotate?: {
    readonly anchor?: ColumnAnchor;
    withRotation(overrides: TOverrides, rotationDeg: number): TOverrides;
  };
  /** Escape hatch: extra state setters + bespoke bridge publish + extra getters. */
  useExtension?(
    ctx: PlacementExtensionCtx<CorePlacementState<TOverrides> & TExtra, TOverrides, TUnits>,
  ): TApi;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createSingleClickPlacementTool<
  TEntity,
  TParams,
  TOverrides extends object,
  TExtra extends object,
  TApi extends object,
  TUnits extends string,
>(
  config: PlacementToolConfig<TEntity, TParams, TOverrides, TExtra, TApi, TUnits>,
): (
  options?: PlacementToolOptions<TEntity, TUnits>,
) => CorePlacementResult<CorePlacementState<TOverrides> & TExtra, TOverrides> & TApi {
  type TState = CorePlacementState<TOverrides> & TExtra;

  const INITIAL_STATE = {
    phase: 'idle',
    overrides: {} as TOverrides,
    error: null,
    ...(config.initialExtra ?? ({} as TExtra)),
  } as TState;

  const resolveOverrides = (s: TState): TOverrides =>
    config.resolveCommitOverrides ? config.resolveCommitOverrides(s) : s.overrides;

  return function usePlacementTool(
    options: PlacementToolOptions<TEntity, TUnits> = {},
  ): CorePlacementResult<TState, TOverrides> & TApi {
    const { onCreated, currentLevelId = '0', getSceneUnits } = options;

    const [state, setState] = useState<TState>(INITIAL_STATE);
    const stateRef = useRef<TState>(state);
    stateRef.current = state;
    const getSceneUnitsRef = useRef(getSceneUnits);
    getSceneUnitsRef.current = getSceneUnits;
    const onCreatedRef = useRef(onCreated);
    onCreatedRef.current = onCreated;

    const resolveSceneUnits = useCallback(
      (): TUnits => getSceneUnitsRef.current?.() ?? config.defaultSceneUnits,
      [],
    );

    const activate = useCallback(() => {
      setState((prev) => ({ ...prev, phase: 'awaitingPosition', error: null }));
    }, []);

    const setParamOverrides = useCallback((overrides: TOverrides) => {
      setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
    }, []);

    const deactivate = useCallback(() => {
      clearPlacementRotationLock();
      setState(INITIAL_STATE);
    }, []);

    const reset = useCallback(() => {
      clearPlacementRotationLock();
      setState((prev) => ({
        ...prev,
        error: null,
        phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
      }));
    }, []);

    const commitFromState = useCallback(
      (s: TState, clickPoint: Readonly<Point2D>): boolean => {
        const params = config.buildParams(clickPoint, resolveOverrides(s), resolveSceneUnits());
        const result = config.buildEntity(params, currentLevelId);
        if (!result.ok) {
          setState({ ...s, error: result.hardErrors[0] ?? null });
          return false;
        }
        onCreatedRef.current?.(result.entity);
        setState({ ...s, error: null, phase: 'awaitingPosition' });
        return true;
      },
      [currentLevelId, resolveSceneUnits],
    );

    const onCanvasClick = useCallback(
      (point: Readonly<Point2D>): boolean => {
        const s = stateRef.current;
        // ADR-514 Φ6d — optional 2-click «place→rotate» (mirror useColumnTool). Absent
        // config.placeThenRotate ⇒ fall through to the classic 1-click FSM below unchanged.
        if (config.placeThenRotate) {
          if (s.phase === 'awaitingPosition') {
            setPlacementRotationLock(point, config.placeThenRotate.anchor ?? 'center');
            setState({ ...s, phase: 'awaitingRotation', error: null });
            return false;
          }
          if (s.phase === 'awaitingRotation') {
            const lock = getPlacementRotationLock();
            clearPlacementRotationLock();
            if (!lock) {
              setState({ ...s, phase: 'awaitingPosition' });
              return false;
            }
            const deg = resolveColumnRotationDeg(
              lock.origin,
              point,
              worldPerPixel(getImmediateTransform().scale),
            );
            const s2 = { ...s, overrides: config.placeThenRotate.withRotation(s.overrides, deg) };
            return commitFromState(s2, lock.origin);
          }
          return false;
        }
        if (s.phase !== 'awaitingPosition') return false;
        return commitFromState(s, point);
      },
      [commitFromState],
    );

    // 3D placement bridge — same commit path as the 2D click (zero duplication).
    const onCanvasClickRef = useRef(onCanvasClick);
    onCanvasClickRef.current = onCanvasClick;
    useEffect(() => {
      if (!config.place3dEvent) return undefined;
      return EventBus.on(config.place3dEvent, ({ point }) => {
        onCanvasClickRef.current(point);
      });
    }, []);

    const getStatusText = useCallback((): string => config.getStatusText(stateRef.current), []);

    const getGhostFootprint = useCallback(
      (cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null => {
        const s = stateRef.current;
        if (s.phase !== 'awaitingPosition' || cursorPos === null) return null;
        const params = config.buildParams(cursorPos, resolveOverrides(s), resolveSceneUnits());
        return config.computeFootprint(params);
      },
      [resolveSceneUnits],
    );

    const isActive = state.phase !== 'idle';

    const getState = useCallback((): TState => stateRef.current, []);

    // Extension escape hatch. `config.useExtension` is a module-constant per factory
    // instantiation → the branch is stable across renders (rules-of-hooks safe).
    const extensionApi = config.useExtension
      ? config.useExtension({
          state,
          isActive,
          getState,
          setState,
          setParamOverrides,
          getSceneUnits: resolveSceneUnits,
        })
      : ({} as TApi);

    const core: CorePlacementResult<TState, TOverrides> = {
      state,
      activate,
      setParamOverrides,
      deactivate,
      reset,
      onCanvasClick,
      getStatusText,
      getGhostFootprint,
      isActive,
      isAwaitingPosition: state.phase === 'awaitingPosition',
    };

    return { ...core, ...extensionApi };
  };
}
