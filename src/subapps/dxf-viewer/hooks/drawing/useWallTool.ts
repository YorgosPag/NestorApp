/**
 * ADR-363 Phase 1B/1C — Wall Tool React Hook Orchestrator.
 *
 * State machine:
 *   - Straight kind (default, Phase 1B):
 *       `idle → awaitingStart → awaitingEnd → committed → awaitingStart`
 *   - Curved kind (Phase 1C):
 *       `idle → awaitingStart → awaitingEnd → awaitingCurveControl → committed → awaitingStart`
 *   - Polyline kind (Phase 1C):
 *       `idle → awaitingStart → awaitingNextVertex (loop) → committed (Enter / dbl-click)`
 *
 * The 2-click straight chain matches AutoCAD/Revit/ArchiCAD conventions; the
 * 3-click curve flow mirrors AutoCAD `ARC` start/end/control; the polyline
 * flow mirrors AutoCAD `PLINE` (Enter to finish, ESC to cancel).
 *
 * SSoT alignment:
 *   - Entity build via `buildWallEntity` / `buildDefaultWallParams`
 *     (`hooks/drawing/wall-completion.ts`). ZERO duplicate construction here.
 *   - Geometry math via `computeWallGeometry` (called inside `buildWallEntity`).
 *   - Live preview via `wallPreviewStore` (`bim/walls/wall-preview-store.ts`)
 *     — single-writer pattern mirroring `stairPreviewStore` (ADR-358 Phase 8).
 *   - Pattern alignment with `useStairTool.ts` (ref-backed setState bypass +
 *     activate/deactivate/reset + status text + Enter listener + Dynamic Input
 *     `commit-wall` event listener).
 *   - ADR-040 micro-leaf compliance: this hook owns its own React state and is
 *     consumed by `useSpecialTools`. No `useSyncExternalStore` against
 *     high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.9 §6 Phase 1B §6 Phase 1C
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { WallKind, WallCategory } from '../../bim/types/wall-types';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
// ADR-363 Phase 1J — «Τοίχος πάνω σε οντότητα 2Δ» geometry bridge.
import { pickWallSourceFromEntity } from '../../bim/walls/wall-from-entity';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import type { WallParamOverrides } from './wall-completion';
import {
  useWallToolDynamicInputListener,
  useWallToolEnterListener,
  useWallToolRegionBoxSelectListener,
  useWallToolPerimeterBoxSelectListener,
} from './use-wall-tool-event-listeners';
import { EventBus } from '../../systems/events/EventBus';
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';
// ADR-363 — state-machine types + commit builders extracted for N.7.1 (≤500 lines).
import {
  INITIAL_STATE,
  type WallPlacementMode,
  type WallToolState,
  type UseWallToolOptions,
  type UseWallToolResult,
} from './wall-tool-types';
import type { RegionMethod } from '../../systems/tools/region-tool-ids';
import { useWallCommit } from './use-wall-commit';
// ADR-363 — in-region / perimeter click handlers extracted for N.7.1 (≤500 lines).
import { useWallRegionClicks } from './use-wall-region-clicks';

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useWallTool(options: UseWallToolOptions = {}): UseWallToolResult {
  const { onWallCreated, currentLevelId = '0', getSceneUnits, getSceneEntities } = options;

  const [state, setState] = useState<WallToolState>(INITIAL_STATE);
  const stateRef = useRef<WallToolState>(state);
  stateRef.current = state;

  // ── preview store sync (ADR-363 Phase 1C) ────────────────────────────────
  // Mirrors `stairPreviewStore` writer pattern: on every state transition we
  // push the current preview shape (startPoint / curveControl / polyline
  // vertices / overrides) so `useUnifiedDrawing.updatePreview` can read it
  // synchronously without subscribing to wall-tool React state.
  useEffect(() => {
    if (state.phase === 'idle') {
      wallPreviewStore.reset();
      return;
    }
    // ADR-363 Phase 1K / «από περίγραμμα» — region & perimeter picks are surfaced
    // via selection highlight (box-select), not a rubber-band ghost. No preview shape.
    if (state.placementMode === 'in-region' || state.placementMode === 'outer-perimeter') {
      wallPreviewStore.reset();
      return;
    }
    // ADR-363 Phase 1J — on-entity: surface the picked line as a straight ghost
    // (start→end shifted toward the live cursor, reusing the Phase 1F preview
    // generator). Closed sources have no rubber-band ghost (multi-wall).
    if (state.placementMode === 'on-entity') {
      if (state.phase === 'awaitingSide' && state.pickedSource?.kind === 'line') {
        wallPreviewStore.set({
          startPoint: state.pickedSource.start,
          endPoint: state.pickedSource.end,
          curveControl: null,
          polylineVertices: [],
          overrides: state.overrides,
        });
      } else {
        wallPreviewStore.reset();
      }
      return;
    }
    const curveControl =
      state.kind === 'curved' && state.phase === 'awaitingCurveControl' && state.endPoint
        ? null // user has not picked the control point yet — preview generator will use cursor
        : null;
    // ADR-363 Phase 1F — surface endPoint to the preview store only during the
    // straight-kind awaitingAlignment phase. In every other state (including
    // curved awaitingCurveControl) the preview falls back to the legacy
    // "start → cursor" rubber band by leaving endPoint null.
    const endPoint =
      state.kind === 'straight' && state.phase === 'awaitingAlignment' ? state.endPoint : null;
    wallPreviewStore.set({
      startPoint: state.startPoint,
      endPoint,
      curveControl,
      polylineVertices: state.polylineVertices,
      overrides: state.overrides,
    });
  }, [state]);

  // Drop preview state on unmount so other tools don't see stale ghosts.
  useEffect(() => {
    return () => {
      wallPreviewStore.reset();
    };
  }, []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      phase: 'awaitingStart',
    }));
  }, []);

  const setKind = useCallback((kind: WallKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingStart',
      overrides: prev.overrides,
    }));
  }, []);

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
  }, []);

  // ADR-419 — set the in-region method ('lines' | 'inside' | 'box'). Driven by the
  // active tool id (wall-region-lines/inside/box). Clears accumulated picks on change.
  const setRegionMethod = useCallback((regionMethod: RegionMethod) => {
    setState((prev) =>
      prev.regionMethod === regionMethod ? prev : { ...prev, regionMethod, regionPicks: [] },
    );
  }, []);

  // ADR-363 Phase 7B — keyboard W+n chord: set wall kind + (re-)activate the tool.
  // setKind is stable (useCallback []) so this listener registers exactly once.
  useEffect(() => EventBus.on('bim:set-wall-kind', ({ kind }) => setKind(kind)), [setKind]);

  const setCategory = useCallback((category: WallCategory) => {
    setState((prev) => ({
      ...prev,
      phase: prev.phase === 'idle' ? 'awaitingStart' : prev.phase,
      overrides: { ...prev.overrides, category },
    }));
  }, []);

  // ADR-363 Phase A — keyboard W+letter chord: set wall category, activates tool if idle.
  useEffect(() => EventBus.on('bim:set-wall-category', ({ category }) => setCategory(category)), [setCategory]);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      placementMode: prev.placementMode,
      regionMethod: prev.regionMethod,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingStart',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: WallParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── incremental back (ADR-363 Phase 1H) ──────────────────────────────────
  // ESC during the straight-wall side-pick (`awaitingAlignment`) rolls back one
  // pick: drop the end, keep the start, return to `awaitingEnd`. Mirrors Revit
  // "Place Wall" Esc semantics (back out one pick instead of exiting). Curved /
  // polyline kinds never reach `awaitingAlignment`, so this is straight-only.
  const backToAwaitingEnd = useCallback((): boolean => {
    if (stateRef.current.phase !== 'awaitingAlignment') return false;
    setState((prev) => ({ ...prev, phase: 'awaitingEnd', endPoint: null, error: null }));
    return true;
  }, []);

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

  // ── commit builders (extracted to ./use-wall-commit for N.7.1) ───────────
  const {
    commitStraightFromState,
    commitCurvedFromState,
    commitPolylineFromState,
    commitOnEntity,
    commitInRegionRects,
    commitPerimeterFaces,
  } = useWallCommit({ currentLevelId, onWallCreated, getSceneUnits, getSceneEntities, setState });

  // ── in-region / perimeter click handlers (extracted for N.7.1) ───────────
  const { regionTol, onRegionClick, onPerimeterClick, getRegionPickIds } = useWallRegionClicks({
    stateRef,
    setState,
    getSceneEntities,
    getSceneUnits,
    commitInRegionRects,
    commitPerimeterFaces,
  });

  // ADR-363 Phase 1K Mode C — box-select listener extracted for N.7.1 (≤500 lines).
  useWallToolRegionBoxSelectListener({ stateRef, getSceneEntities, regionTol, commitInRegionRects });
  // ADR-363 «Τοίχος από περίγραμμα» — box-select listener (faces → leg walls).
  useWallToolPerimeterBoxSelectListener({ stateRef, getSceneEntities, regionTol, commitPerimeterFaces });

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      // ADR-363 Phase 1K — in-region placement (pick 4 lines / click inside).
      if (s.placementMode === 'in-region') {
        return onRegionClick(s, point);
      }

      // ADR-363 «Τοίχος από περίγραμμα» — click inside a perimeter (box-select primary).
      if (s.placementMode === 'outer-perimeter') {
        return onPerimeterClick(s, point);
      }

      // ADR-363 Phase 1J — on-entity placement (pick entity → pick side).
      if (s.placementMode === 'on-entity') {
        if (s.phase === 'awaitingStart') {
          const entities = getSceneEntities?.() ?? [];
          const tol = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
          const source = pickWallSourceFromEntity(point, entities, tol);
          if (!source) return false; // missed — stay in awaitingStart
          setState({ ...s, phase: 'awaitingSide', pickedSource: source, error: null });
          return true;
        }
        if (s.phase === 'awaitingSide') {
          return commitOnEntity(s, point);
        }
        return false;
      }

      // Polyline kind — N-click flow.
      if (s.kind === 'polyline') {
        if (s.phase === 'awaitingStart') {
          setState({
            ...s,
            phase: 'awaitingNextVertex',
            startPoint: { x: point.x, y: point.y },
            polylineVertices: [{ x: point.x, y: point.y }],
            error: null,
          });
          return true;
        }
        if (s.phase === 'awaitingNextVertex') {
          setState({
            ...s,
            polylineVertices: [...s.polylineVertices, { x: point.x, y: point.y }],
            error: null,
          });
          return true;
        }
        return false;
      }

      // Curved kind — 3-click flow.
      if (s.kind === 'curved') {
        if (s.phase === 'awaitingStart') {
          setState({
            ...s,
            phase: 'awaitingEnd',
            startPoint: { x: point.x, y: point.y },
            endPoint: null,
            error: null,
          });
          return true;
        }
        if (s.phase === 'awaitingEnd') {
          setState({
            ...s,
            phase: 'awaitingCurveControl',
            endPoint: { x: point.x, y: point.y },
            error: null,
          });
          return true;
        }
        if (s.phase === 'awaitingCurveControl') {
          return commitCurvedFromState(s, point);
        }
        return false;
      }

      // Straight kind — 3-click chain (ADR-363 Phase 1F):
      //   click 1 (awaitingStart)     → store start, → awaitingEnd
      //   click 2 (awaitingEnd)       → store end,   → awaitingAlignment
      //   click 3 (awaitingAlignment) → commit with lateral offset toward C
      if (s.phase === 'awaitingStart') {
        setState({
          ...s,
          phase: 'awaitingEnd',
          startPoint: { x: point.x, y: point.y },
          error: null,
        });
        return true;
      }
      if (s.phase === 'awaitingEnd' && s.startPoint) {
        setState({
          ...s,
          phase: 'awaitingAlignment',
          endPoint: { x: point.x, y: point.y },
          error: null,
        });
        return true;
      }
      if (s.phase === 'awaitingAlignment' && s.startPoint && s.endPoint) {
        return commitStraightFromState(s, s.endPoint, point);
      }
      return false;
    },
    [
      commitStraightFromState,
      commitCurvedFromState,
      commitOnEntity,
      getSceneEntities,
      onRegionClick,
      onPerimeterClick,
    ],
  );

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

  const finishPolyline = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.kind !== 'polyline') return false;
    if (s.phase !== 'awaitingNextVertex') return false;
    return commitPolylineFromState(s);
  }, [commitPolylineFromState]);

  // ── status text (i18n keys returned for caller-resolved translation) ─────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    // ADR-419 — in-region prompts ανά τρόπο (4 γραμμές / κλικ μέσα / πλαίσιο).
    if (s.placementMode === 'in-region') {
      if (s.regionMethod === 'inside') return 'tools.wall.statusRegionInsidePick';
      if (s.regionMethod === 'box') return 'tools.wall.statusRegionBoxPick';
      return s.regionPicks.length > 0
        ? 'tools.wall.statusRegionMore'
        : 'tools.wall.statusRegionLinesPick';
    }
    // ADR-363 «Τοίχος από περίγραμμα» — box-select prompt.
    if (s.placementMode === 'outer-perimeter') {
      return 'tools.wall.statusPerimeterPick';
    }
    // ADR-363 Phase 1J — on-entity prompts.
    if (s.placementMode === 'on-entity') {
      if (s.phase === 'awaitingStart') return 'tools.wall.statusPickEntity';
      if (s.phase === 'awaitingSide') return 'tools.wall.statusPickSide';
      return '';
    }
    switch (s.phase) {
      case 'awaitingStart':
        return 'tools.wall.statusStart';
      case 'awaitingEnd':
        return s.kind === 'curved'
          ? 'tools.wall.statusCurveEnd'
          : 'tools.wall.statusEnd';
      case 'awaitingAlignment':
        return 'tools.wall.statusAlignment';
      case 'awaitingCurveControl':
        return 'tools.wall.statusCurveControl';
      case 'awaitingNextVertex':
        return 'tools.wall.statusPolyNext';
      default:
        return '';
    }
  }, []);

  // ── side-effect listeners (extracted for N.7.1, parity preserved) ────────
  useWallToolDynamicInputListener({
    stateRef,
    setState,
    commitStraightFromState,
    commitCurvedFromState,
  });
  useWallToolEnterListener({ stateRef, commitPolylineFromState });

  return {
    state,
    activate,
    setKind,
    setPlacementMode,
    setRegionMethod,
    deactivate,
    reset,
    backToAwaitingEnd,
    onCanvasClick,
    finishPolyline,
    setParamOverrides,
    getStatusText,
    getRegionPickIds,
    isActive: state.phase !== 'idle',
    isAwaitingStart: state.phase === 'awaitingStart',
    isAwaitingEnd: state.phase === 'awaitingEnd',
    isAwaitingAlignment: state.phase === 'awaitingAlignment',
    isAwaitingCurveControl: state.phase === 'awaitingCurveControl',
    isAwaitingNextVertex: state.phase === 'awaitingNextVertex',
    isAwaitingSide: state.phase === 'awaitingSide',
  };
}
