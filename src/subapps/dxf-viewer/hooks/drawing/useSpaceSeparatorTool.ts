/**
 * ADR-437 — Space Separator Tool React Hook Orchestrator.
 *
 * State machine (2-click chain — mirrors `useMepSegmentTool`):
 *   `idle → awaitingStart → awaitingEnd → committed → awaitingStart`
 *
 * The tool places one space-separation line per 2-click interaction. ESC reset is
 * handled centrally by EscapeCommandBus / useToolLifecycle (ADR-364 §4.1).
 *
 * SSoT alignment:
 *   - Entity build via `completeSpaceSeparatorFromTwoClicks` (`space-separator-completion.ts`).
 *   - Scene append + EventBus broadcast performed by the caller (`useSpecialTools`).
 *   - ADR-040 micro-leaf compliance: hook owns React state, no `useSyncExternalStore`.
 *
 * Result shape is compatible with `useSpecialTools` wiring (same contract as
 * `useMepSegmentTool`).
 *
 * @see ./useMepSegmentTool.ts (2-click FSM template)
 * @see docs/centralized-systems/reference/adrs/ADR-437-space-separation-lines.md
 */

import { useCallback, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { SpaceSeparatorEntity } from '../../bim/types/space-separator-types';
import {
  completeSpaceSeparatorFromTwoClicks,
  type SpaceSeparatorParamOverrides,
  type SceneUnits,
} from './space-separator-completion';

// ─── State machine types ─────────────────────────────────────────────────────

export type SpaceSeparatorToolPhase = 'idle' | 'awaitingStart' | 'awaitingEnd';

export interface SpaceSeparatorToolState {
  readonly phase: SpaceSeparatorToolPhase;
  readonly startPoint: Point2D | null;
  readonly overrides: SpaceSeparatorParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: SpaceSeparatorToolState = {
  phase: 'idle',
  startPoint: null,
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseSpaceSeparatorToolOptions {
  /** Callback fired after successful entity build. Caller appends to scene + broadcasts. */
  readonly onSpaceSeparatorCreated?: (entity: SpaceSeparatorEntity) => void;
  /** Layer ID written on the new separator entity. */
  readonly currentLevelId?: string;
  /** Returns the active scene's coordinate units for threshold scaling. */
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseSpaceSeparatorToolResult {
  readonly state: SpaceSeparatorToolState;
  activate(): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new separator or advanced the FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Ribbon overrides (name / floor). */
  setParamOverrides(overrides: SpaceSeparatorParamOverrides): void;
  /** Status text i18n key for status-bar / Dynamic Input prompt. */
  getStatusText(): string;
  /** Live ghost axis [start, cursor] for plan-view overlay, or null. Pure (ADR-040). */
  getGhostSegment(cursor: Readonly<Point2D> | null): readonly [Point2D, Point2D] | null;
  readonly isActive: boolean;
  readonly isAwaitingStart: boolean;
  readonly isAwaitingEnd: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useSpaceSeparatorTool(
  options: UseSpaceSeparatorToolOptions = {},
): UseSpaceSeparatorToolResult {
  const { onSpaceSeparatorCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<SpaceSeparatorToolState>(INITIAL_STATE);
  const stateRef = useRef<SpaceSeparatorToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onSpaceSeparatorCreated);
  onCreatedRef.current = onSpaceSeparatorCreated;

  // ── lifecycle ──────────────────────────────────────────────────────────────

  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, overrides: prev.overrides, phase: 'awaitingStart' }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingStart',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: SpaceSeparatorParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit (2nd click) ──────────────────────────────────────────────────────

  const commitFromState = useCallback(
    (s: SpaceSeparatorToolState, endPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null) return false;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const result = completeSpaceSeparatorFromTwoClicks(
        s.startPoint,
        endPoint,
        currentLevelId,
        s.overrides,
        sceneUnits,
      );
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onCreatedRef.current?.(result.entity);
      setState({ ...INITIAL_STATE, overrides: s.overrides, phase: 'awaitingStart' });
      return true;
    },
    [currentLevelId],
  );

  // ── click pipeline ───────────────────────────────────────────────────────────

  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      if (s.phase === 'awaitingStart') {
        setState({ ...s, phase: 'awaitingEnd', startPoint: { x: point.x, y: point.y }, error: null });
        return true;
      }

      if (s.phase === 'awaitingEnd' && s.startPoint !== null) {
        return commitFromState(s, point);
      }

      return false;
    },
    [commitFromState],
  );

  // ── status text (i18n keys) ───────────────────────────────────────────────────

  const getStatusText = useCallback((): string => {
    switch (stateRef.current.phase) {
      case 'awaitingStart':
        return 'tools.spaceSeparator.statusStart';
      case 'awaitingEnd':
        return 'tools.spaceSeparator.statusEnd';
      default:
        return '';
    }
  }, []);

  // ── ghost segment (plan-view axis overlay) ────────────────────────────────────

  const getGhostSegment = useCallback(
    (cursor: Readonly<Point2D> | null): readonly [Point2D, Point2D] | null => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingEnd' || s.startPoint === null || cursor === null) return null;
      return [s.startPoint, { x: cursor.x, y: cursor.y }];
    },
    [],
  );

  return {
    state,
    activate,
    deactivate,
    reset,
    onCanvasClick,
    setParamOverrides,
    getStatusText,
    getGhostSegment,
    isActive: state.phase !== 'idle',
    isAwaitingStart: state.phase === 'awaitingStart',
    isAwaitingEnd: state.phase === 'awaitingEnd',
  };
}
