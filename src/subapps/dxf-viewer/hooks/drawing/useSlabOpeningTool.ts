/**
 * ADR-363 Phase 3.7 — Slab-Opening Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingHostSlab → awaitingPosition → committed → awaitingHostSlab
 *
 * Click-1: resolve host slab via injected `getSlabAtPoint`. Click-2: commit
 * cutout στο projected position. ESC mid-flow → επιστροφή σε
 * `awaitingHostSlab` (kind + overrides preserved). Continuous chain μετά
 * commit (mirror useOpeningTool).
 *
 * SSoT alignment:
 *   - Entity build via `buildSlabOpeningEntity` / `buildDefaultSlabOpeningParams`
 *     (`slab-opening-completion.ts`). ZERO duplicate construction.
 *   - Pattern alignment με `useOpeningTool.ts`.
 *   - ADR-040 micro-leaf compliance: own React state, ZERO subscriptions.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 */

import { useCallback, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type {
  SlabOpeningEntity,
  SlabOpeningKind,
} from '../../bim/types/slab-opening-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import {
  buildSlabOpeningEntity,
  buildDefaultSlabOpeningParams,
  type SlabOpeningParamOverrides,
  type SceneUnits,
} from './slab-opening-completion';

// ─── State machine types ────────────────────────────────────────────────────

export type SlabOpeningToolPhase =
  | 'idle'
  | 'awaitingHostSlab'
  | 'awaitingPosition'
  | 'committed';

export interface SlabOpeningToolState {
  readonly phase: SlabOpeningToolPhase;
  readonly kind: SlabOpeningKind;
  readonly hostSlabId: string | null;
  readonly overrides: SlabOpeningParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: SlabOpeningToolState = {
  phase: 'idle',
  kind: 'shaft',
  hostSlabId: null,
  overrides: {},
  error: null,
};

// ─── Hook options + return ──────────────────────────────────────────────────

export interface UseSlabOpeningToolOptions {
  readonly onSlabOpeningCreated?: (entity: SlabOpeningEntity) => void;
  readonly currentLevelId?: string;
  /**
   * Resolver: given a slab id, returns the host `SlabEntity` (or null when
   * the id no longer maps). Caller wires from level manager.
   */
  readonly getSlabById: (slabId: string) => SlabEntity | null;
  /**
   * Resolver: given a click point, returns the slab under the cursor (or
   * null). Caller wires from hit-test service.
   */
  readonly getSlabAtPoint: (point: Readonly<Point2D>) => SlabEntity | null;
  /**
   * Returns the active scene's coordinate units. Mirror του `useSlabTool`
   * (ADR-370 scene-units SSoT). Όταν undefined → default 'mm' (legacy paths
   * / tests where vertices είναι ήδη mm).
   */
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseSlabOpeningToolResult {
  readonly state: SlabOpeningToolState;
  activate(): void;
  /** Switch active kind (4 kinds). Resets the state machine. */
  setKind(kind: SlabOpeningKind): void;
  deactivate(): void;
  reset(): void;
  /** Returns true όταν το click προωθεί το FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Dynamic Input field overrides (width / depth / fireRating ...). */
  setParamOverrides(overrides: SlabOpeningParamOverrides): void;
  /** Status text (i18n key) για status-bar / Dynamic Input prompt. */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingHostSlab: boolean;
  readonly isAwaitingPosition: boolean;
}

// ─── Hook implementation ────────────────────────────────────────────────────

export function useSlabOpeningTool(
  options: UseSlabOpeningToolOptions,
): UseSlabOpeningToolResult {
  const { onSlabOpeningCreated, currentLevelId = '0', getSlabById, getSlabAtPoint, getSceneUnits } = options;

  const [state, setState] = useState<SlabOpeningToolState>(INITIAL_STATE);
  const stateRef = useRef<SlabOpeningToolState>(state);
  stateRef.current = state;

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      overrides: prev.overrides,
      phase: 'awaitingHostSlab',
    }));
  }, []);

  const setKind = useCallback((kind: SlabOpeningKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingHostSlab',
      overrides: prev.overrides,
    }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingHostSlab',
    }));
  }, []);

  const setParamOverrides = useCallback(
    (overrides: SlabOpeningParamOverrides) => {
      setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
    },
    [],
  );

  // ── commit ───────────────────────────────────────────────────────────────
  const commitFromState = useCallback(
    (
      s: SlabOpeningToolState,
      hostSlab: SlabEntity,
      clickPoint: Readonly<Point2D>,
    ): boolean => {
      const overridesWithKind: SlabOpeningParamOverrides = {
        ...s.overrides,
        kind: s.kind,
      };
      const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
      const params = buildDefaultSlabOpeningParams(
        hostSlab,
        clickPoint,
        overridesWithKind,
        sceneUnits,
      );
      const result = buildSlabOpeningEntity(params, hostSlab, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onSlabOpeningCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        overrides: s.overrides,
        phase: 'awaitingHostSlab',
      });
      return true;
    },
    [currentLevelId, onSlabOpeningCreated, getSceneUnits],
  );

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      if (s.phase === 'awaitingHostSlab') {
        const slab = getSlabAtPoint(point);
        if (!slab) {
          setState({ ...s, error: 'slabOpening.tool.errors.missingHostSlab' });
          return false;
        }
        setState({
          ...s,
          phase: 'awaitingPosition',
          hostSlabId: slab.id,
          error: null,
        });
        return true;
      }

      if (s.phase === 'awaitingPosition' && s.hostSlabId) {
        const slab = getSlabById(s.hostSlabId);
        if (!slab) {
          setState({
            ...s,
            phase: 'awaitingHostSlab',
            hostSlabId: null,
            error: 'slabOpening.tool.errors.missingHostSlab',
          });
          return false;
        }
        return commitFromState(s, slab, point);
      }

      return false;
    },
    [getSlabAtPoint, getSlabById, commitFromState],
  );

  // ── status text (i18n keys) ──────────────────────────────────────────────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    switch (s.phase) {
      case 'awaitingHostSlab':
        return 'tools.slabOpening.statusHostSlab';
      case 'awaitingPosition':
        return 'tools.slabOpening.statusPosition';
      default:
        return '';
    }
  }, []);

  // ── ESC handled by EscapeCommandBus (ADR-364 §4.1 BIM migration 2026-05-19)
  // DRAW_TOOL slot in useKeyboardShortcuts deactivates tool to 'select'.

  return {
    state,
    activate,
    setKind,
    deactivate,
    reset,
    onCanvasClick,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
    isAwaitingHostSlab: state.phase === 'awaitingHostSlab',
    isAwaitingPosition: state.phase === 'awaitingPosition',
  };
}
