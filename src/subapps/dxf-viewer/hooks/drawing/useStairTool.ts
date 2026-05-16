/**
 * ADR-358 Phase 5a — Stair Tool React Hook Orchestrator.
 *
 * State machine: `idle → awaitingBasePoint → awaitingDirection → confirming →
 * committed → awaitingBasePoint` (continuous chain — matches industry convention
 * AutoCAD/ArchiCAD/Vectorworks for repeated placement).
 *
 * SSoT alignment:
 *   - Entity build via `buildStairEntity` / `buildDefaultStairParams`
 *     (`hooks/drawing/stair-completion.ts`). ZERO duplicate construction here.
 *   - Geometry math via `computeStairGeometry` (called inside `buildStairEntity`).
 *   - Pattern alignment with `useLineParallel.ts` + `useCircleTTT.ts`
 *     (ref-backed setState bypass + activate/deactivate/reset + status text).
 *   - ADR-040 micro-leaf compliance: this hook owns its own React state and is
 *     consumed by `useSpecialTools` exactly like `useCircleTTT`. No
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * Default `variant.kind = 'straight'` (Phase 5a). Variant override lands the
 * contextual ribbon Phase 7a. Dynamic Input feeds `rise/tread/width` overrides
 * via `setParamOverrides` (`systems/dynamic-input/keyboard-handlers/stair-keyboard-handler.ts`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §6.1 §6.2 §9.1 Q2
 */

import { useCallback, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { StairEntity } from '../../types/stair';
import {
  buildDefaultStairParams,
  buildStairEntity,
  directionFromPoints,
  type StairParamOverrides,
} from './stair-completion';

// ─── State machine types ─────────────────────────────────────────────────────

export type StairToolPhase =
  | 'idle'
  | 'awaitingBasePoint'
  | 'awaitingDirection'
  | 'confirming';

export interface StairToolState {
  readonly phase: StairToolPhase;
  readonly basePoint: Point2D | null;
  readonly direction: number | null;
  readonly overrides: StairParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: StairToolState = {
  phase: 'idle',
  basePoint: null,
  direction: null,
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseStairToolOptions {
  /** Callback fired after a `StairEntity` is built & committed. */
  readonly onStairCreated?: (entity: StairEntity) => void;
  /** Layer ID at which the StairEntity is registered. */
  readonly currentLevelId?: string;
}

export interface UseStairToolResult {
  readonly state: StairToolState;
  activate(): void;
  deactivate(): void;
  reset(): void;
  /** Returns true if the click advanced the state machine. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Confirm step — triggered by Enter or autoconfirm from Dynamic Input. */
  confirm(): boolean;
  /** Dynamic Input field overrides (rise/tread/width). */
  setParamOverrides(overrides: StairParamOverrides): void;
  /** Status text for status-bar / Dynamic Input prompt. */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingBasePoint: boolean;
  readonly isAwaitingDirection: boolean;
  readonly isConfirming: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useStairTool(options: UseStairToolOptions = {}): UseStairToolResult {
  const { onStairCreated, currentLevelId = '0' } = options;

  const [state, setState] = useState<StairToolState>(INITIAL_STATE);
  const stateRef = useRef<StairToolState>(state);
  stateRef.current = state;

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState({ ...INITIAL_STATE, phase: 'awaitingBasePoint' });
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingBasePoint',
      basePoint: null,
      direction: null,
      overrides: prev.overrides,
      error: null,
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: StairParamOverrides) => {
    setState(prev => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit ───────────────────────────────────────────────────────────────
  const commitFromState = useCallback((s: StairToolState): boolean => {
    if (s.basePoint === null || s.direction === null) return false;
    const params = buildDefaultStairParams(s.basePoint, s.direction, s.overrides);
    const entity = buildStairEntity(params, currentLevelId);
    onStairCreated?.(entity);
    setState({
      phase: 'awaitingBasePoint',
      basePoint: null,
      direction: null,
      overrides: s.overrides,
      error: null,
    });
    return true;
  }, [currentLevelId, onStairCreated]);

  const confirm = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.phase !== 'confirming') return false;
    return commitFromState(s);
  }, [commitFromState]);

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback((point: Readonly<Point2D>): boolean => {
    const s = stateRef.current;
    if (s.phase === 'idle') return false;
    if (s.phase === 'awaitingBasePoint') {
      setState({
        phase: 'awaitingDirection',
        basePoint: { x: point.x, y: point.y },
        direction: null,
        overrides: s.overrides,
        error: null,
      });
      return true;
    }
    if (s.phase === 'awaitingDirection' && s.basePoint) {
      const direction = directionFromPoints(s.basePoint, point);
      setState({
        phase: 'confirming',
        basePoint: s.basePoint,
        direction,
        overrides: s.overrides,
        error: null,
      });
      return true;
    }
    if (s.phase === 'confirming') {
      return commitFromState(s);
    }
    return false;
  }, [commitFromState]);

  // ── status text (i18n keys returned for caller-resolved translation) ─────
  const getStatusText = useCallback((): string => {
    switch (stateRef.current.phase) {
      case 'awaitingBasePoint': return 'tools.stair.statusBasePoint';
      case 'awaitingDirection': return 'tools.stair.statusDirection';
      case 'confirming': return 'tools.stair.statusConfirm';
      default: return '';
    }
  }, []);

  return {
    state,
    activate,
    deactivate,
    reset,
    onCanvasClick,
    confirm,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
    isAwaitingBasePoint: state.phase === 'awaitingBasePoint',
    isAwaitingDirection: state.phase === 'awaitingDirection',
    isConfirming: state.phase === 'confirming',
  };
}
