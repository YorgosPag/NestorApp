/**
 * ADR-363 Phase 2 — Opening Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingHostWall → awaitingPosition → committed → awaitingHostWall
 *
 * Phase 1 hover-over-wall highlight is shown while the user is hunting for a
 * host (state: awaitingHostWall). Once a wall is clicked → host locked, state
 * advances to `awaitingPosition`. Next click commits at the projected offset.
 * ESC at any time → reset to `awaitingHostWall` (kind preserved).
 *
 * Continuous draw: after commit, the tool stays in `awaitingHostWall` so the
 * user can place a second opening (mirrors useWallTool continuous chain).
 *
 * SSoT alignment:
 *   - Entity build via `buildOpeningEntity` / `buildDefaultOpeningParams`
 *     (`hooks/drawing/opening-completion.ts`). ZERO duplicate construction.
 *   - Pattern alignment με `useWallTool.ts` (ref-backed state + activate /
 *     deactivate / reset + status text).
 *   - ADR-040 micro-leaf compliance: this hook owns its own React state.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4 §6 Phase 2
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { OpeningEntity, OpeningKind } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import {
  buildOpeningEntity,
  buildDefaultOpeningParams,
  type OpeningParamOverrides,
} from './opening-completion';

// ─── State machine types ─────────────────────────────────────────────────────

export type OpeningToolPhase =
  | 'idle'
  | 'awaitingHostWall'
  | 'awaitingPosition'
  | 'committed';

export interface OpeningToolState {
  readonly phase: OpeningToolPhase;
  readonly kind: OpeningKind;
  readonly hostWallId: string | null;
  readonly overrides: OpeningParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: OpeningToolState = {
  phase: 'idle',
  kind: 'door',
  hostWallId: null,
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseOpeningToolOptions {
  /** Callback fired after an `OpeningEntity` is built & committed. */
  readonly onOpeningCreated?: (entity: OpeningEntity) => void;
  /** Layer ID at which the OpeningEntity is registered. */
  readonly currentLevelId?: string;
  /**
   * Resolver: given a wall id, return the host `WallEntity` (or null when the
   * id no longer maps to a wall in scene). Caller wires this from the level
   * manager — the hook stays scene-agnostic.
   */
  readonly getWallById: (wallId: string) => WallEntity | null;
  /**
   * Resolver: given a click point, return the wall under the cursor (or null
   * when no wall sits below). Caller wires this from the hit-test service.
   */
  readonly getWallAtPoint: (point: Readonly<Point2D>) => WallEntity | null;
}

export interface UseOpeningToolResult {
  readonly state: OpeningToolState;
  activate(): void;
  /** Switch active kind (5 kinds). Resets the state machine. */
  setKind(kind: OpeningKind): void;
  deactivate(): void;
  reset(): void;
  /** Returns true if the click advanced the state machine. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Dynamic Input field overrides (width / height / sill / handing). */
  setParamOverrides(overrides: OpeningParamOverrides): void;
  /** Status text for status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingHostWall: boolean;
  readonly isAwaitingPosition: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useOpeningTool(options: UseOpeningToolOptions): UseOpeningToolResult {
  const { onOpeningCreated, currentLevelId = '0', getWallById, getWallAtPoint } = options;

  const [state, setState] = useState<OpeningToolState>(INITIAL_STATE);
  const stateRef = useRef<OpeningToolState>(state);
  stateRef.current = state;

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, kind: prev.kind, phase: 'awaitingHostWall' }));
  }, []);

  const setKind = useCallback((kind: OpeningKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingHostWall',
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
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingHostWall',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: OpeningParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit ───────────────────────────────────────────────────────────────
  /**
   * Build + commit an opening from a locked host wall + click point. Validator
   * failure aborts silently — the tool stays in awaitingPosition so the user
   * can retry (e.g. move the click inside the wall length).
   */
  const commitOpeningFromState = useCallback(
    (s: OpeningToolState, hostWall: WallEntity, clickPoint: Readonly<Point2D>): boolean => {
      const overridesWithKind: OpeningParamOverrides = { ...s.overrides, kind: s.kind };
      const params = buildDefaultOpeningParams(hostWall, clickPoint, overridesWithKind);
      const result = buildOpeningEntity(params, hostWall, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onOpeningCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        overrides: s.overrides,
        phase: 'awaitingHostWall',
      });
      return true;
    },
    [currentLevelId, onOpeningCreated],
  );

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      if (s.phase === 'awaitingHostWall') {
        const wall = getWallAtPoint(point);
        if (!wall) {
          setState({ ...s, error: 'opening.tool.errors.noHostWall' });
          return false;
        }
        setState({
          ...s,
          phase: 'awaitingPosition',
          hostWallId: wall.id,
          error: null,
        });
        return true;
      }

      if (s.phase === 'awaitingPosition' && s.hostWallId) {
        const wall = getWallById(s.hostWallId);
        if (!wall) {
          // Host wall vanished between clicks — bounce back to awaitingHostWall.
          setState({ ...s, phase: 'awaitingHostWall', hostWallId: null, error: 'opening.tool.errors.hostMissing' });
          return false;
        }
        return commitOpeningFromState(s, wall, point);
      }

      return false;
    },
    [getWallAtPoint, getWallById, commitOpeningFromState],
  );

  // ── status text (i18n keys returned για caller-resolved translation) ─────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    switch (s.phase) {
      case 'awaitingHostWall':
        return 'tools.opening.statusHostWall';
      case 'awaitingPosition':
        return 'tools.opening.statusPosition';
      default:
        return '';
    }
  }, []);

  // ── ESC handling ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = stateRef.current;
      if (s.phase === 'idle') return;
      // ESC mid-flow → release host and restart awaitingHostWall.
      if (s.phase === 'awaitingPosition') {
        setState({ ...s, phase: 'awaitingHostWall', hostWallId: null, error: null });
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

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
    isAwaitingHostWall: state.phase === 'awaitingHostWall',
    isAwaitingPosition: state.phase === 'awaitingPosition',
  };
}
