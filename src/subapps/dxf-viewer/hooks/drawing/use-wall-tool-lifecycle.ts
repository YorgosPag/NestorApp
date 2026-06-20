/**
 * ADR-363 — Wall Tool lifecycle & state-setter callbacks (extracted for N.7.1 ≤500 lines).
 *
 * Owns the tool's lifecycle (activate / deactivate / reset) + the param setters
 * (kind / placement-mode / region-method / category / overrides) + the
 * incremental-back ESC handlers (alignment-back, on-entity-back, in-region-back) +
 * the keyboard-chord EventBus listeners (set-wall-kind / set-wall-category).
 *
 * Pure orchestration over the parent's `setState` / `stateRef` — no React state of
 * its own, so the parent `useWallTool` keeps a single source of truth for state.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 */

import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { WallKind, WallCategory } from '../../bim/types/wall-types';
import type { WallParamOverrides } from './wall-completion';
import { EventBus } from '../../systems/events/EventBus';
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';
import {
  INITIAL_STATE,
  type WallPlacementMode,
  type WallToolState,
} from './wall-tool-types';
import type { RegionMethod } from '../../systems/tools/region-tool-ids';

export interface UseWallToolLifecycleArgs {
  readonly stateRef: MutableRefObject<WallToolState>;
  readonly setState: Dispatch<SetStateAction<WallToolState>>;
  readonly syncSceneTargetsToStore: () => void;
}

export interface UseWallToolLifecycleResult {
  readonly activate: () => void;
  readonly setKind: (kind: WallKind) => void;
  readonly setPlacementMode: (mode: WallPlacementMode) => void;
  readonly setRegionMethod: (regionMethod: RegionMethod) => void;
  readonly deactivate: () => void;
  readonly reset: () => void;
  readonly backToAwaitingEnd: () => boolean;
  readonly setParamOverrides: (overrides: WallParamOverrides) => void;
}

export function useWallToolLifecycle({
  stateRef,
  setState,
  syncSceneTargetsToStore,
}: UseWallToolLifecycleArgs): UseWallToolLifecycleResult {
  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    // ADR-508 — φόρτωσε snap targets ΠΡΙΝ το 1ο hover ώστε το ghost-before-click να κουμπώνει.
    syncSceneTargetsToStore();
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      phase: 'awaitingStart',
    }));
  }, [syncSceneTargetsToStore, setState]);

  const setKind = useCallback((kind: WallKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingStart',
      overrides: prev.overrides,
    }));
  }, [setState]);

  // ADR-363 Phase 1J — switch placement mode (freehand ⇄ on-entity). Resets the
  // state machine (keeps kind + overrides). No-op effect when phase is idle.
  const setPlacementMode = useCallback((mode: WallPlacementMode) => {
    setState((prev) => {
      if (prev.placementMode === mode) return prev;
      return {
        ...INITIAL_STATE,
        kind: prev.kind,
        overrides: prev.overrides,
        regionMethod: prev.regionMethod,
        placementMode: mode,
        phase: prev.phase === 'idle' ? 'idle' : 'awaitingStart',
      };
    });
  }, [setState]);

  // ADR-419 — set the in-region method ('lines' | 'inside' | 'box'). Driven by the
  // active tool id (wall-region-lines/inside/box). Clears accumulated picks on change.
  const setRegionMethod = useCallback((regionMethod: RegionMethod) => {
    setState((prev) =>
      prev.regionMethod === regionMethod ? prev : { ...prev, regionMethod, regionPicks: [] },
    );
  }, [setState]);

  // ADR-363 Phase 7B — keyboard W+n chord: set wall kind + (re-)activate the tool.
  // setKind is stable (useCallback []) so this listener registers exactly once.
  useEffect(() => EventBus.on('bim:set-wall-kind', ({ kind }) => setKind(kind)), [setKind]);

  const setCategory = useCallback((category: WallCategory) => {
    setState((prev) => ({
      ...prev,
      phase: prev.phase === 'idle' ? 'awaitingStart' : prev.phase,
      overrides: { ...prev.overrides, category },
    }));
  }, [setState]);

  // ADR-363 Phase A — keyboard W+letter chord: set wall category, activates tool if idle.
  useEffect(() => EventBus.on('bim:set-wall-category', ({ category }) => setCategory(category)), [setCategory]);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, [setState]);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingStart',
    }));
  }, [setState]);

  const setParamOverrides = useCallback((overrides: WallParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, [setState]);

  // ── incremental back (ADR-363 Phase 1H) ──────────────────────────────────
  // ESC during the straight-wall side-pick (`awaitingAlignment`) rolls back one
  // pick: drop the end, keep the start, return to `awaitingEnd`. Mirrors Revit
  // "Place Wall" Esc semantics (back out one pick instead of exiting). Curved /
  // polyline kinds never reach `awaitingAlignment`, so this is straight-only.
  const backToAwaitingEnd = useCallback((): boolean => {
    if (stateRef.current.phase !== 'awaitingAlignment') return false;
    setState((prev) => ({ ...prev, phase: 'awaitingEnd', endPoint: null, error: null }));
    return true;
  }, [stateRef, setState]);

  // ESC bus registration — priority above DRAW_TOOL so the incremental back-step
  // wins over the generic "cancel drawing" handler that would deactivate the tool.
  useEscapeHandler({
    id: 'wall-tool/alignment-back',
    priority: ESC_PRIORITY.WALL_ALIGNMENT_BACK,
    canHandle: () => stateRef.current.phase === 'awaitingAlignment',
    handle: () => backToAwaitingEnd(),
  });

  // ADR-363 Phase 1J — on-entity incremental back: ESC during the side-pick drops
  // the picked source and returns to awaitingStart (re-pick the entity) instead
  // of deactivating the tool.
  useEscapeHandler({
    id: 'wall-tool/on-entity-back',
    priority: ESC_PRIORITY.WALL_ALIGNMENT_BACK,
    canHandle: () =>
      stateRef.current.placementMode === 'on-entity' && stateRef.current.phase === 'awaitingSide',
    handle: () => {
      setState((prev) => ({ ...prev, phase: 'awaitingStart', pickedSource: null, error: null }));
      return true;
    },
  });

  // ESC during in-region: drop accumulated picks (back to empty collecting)
  // instead of deactivating; no-op when there are no picks (generic ESC exits).
  useEscapeHandler({
    id: 'wall-tool/in-region-back',
    priority: ESC_PRIORITY.WALL_ALIGNMENT_BACK,
    canHandle: () =>
      stateRef.current.placementMode === 'in-region' && stateRef.current.regionPicks.length > 0,
    handle: () => {
      setState((prev) => ({ ...prev, regionPicks: [], error: null }));
      return true;
    },
  });

  return {
    activate,
    setKind,
    setPlacementMode,
    setRegionMethod,
    deactivate,
    reset,
    backToAwaitingEnd,
    setParamOverrides,
  };
}
