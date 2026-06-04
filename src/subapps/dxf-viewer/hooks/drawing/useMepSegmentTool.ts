/**
 * ADR-408 Φ8 — MEP Segment Tool React Hook Orchestrator.
 *
 * State machine (2-click chain — mirrors `useBeamTool` straight/cantilever):
 *   `idle → awaitingStart → awaitingEnd → committed → awaitingStart`
 *
 * The tool places one duct or pipe segment per 2-click interaction.
 * ESC reset is handled centrally by EscapeCommandBus / useToolLifecycle
 * (ADR-364 §4.1 BIM migration pattern).
 *
 * SSoT alignment:
 *   - Entity build via `completeMepSegmentFromTwoClicks` (`mep-segment-completion.ts`).
 *   - Scene append + EventBus broadcast via `addMepSegmentToScene`.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * Result shape is compatible with `useSpecialTools` wiring (same contract as
 * `useBeamTool` + `useElectricalPanelTool`).
 *
 * @see ./beam-completion.ts (2-click FSM template)
 * @see ./useElectricalPanelTool.ts (result-shape contract template)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';

/**
 * A click point that may carry a connector elevation `z` (mm) when it snapped to
 * an MEP connector (ADR-408 Φ-B1 connector-mate). `z` absent ⇒ free point.
 */
export type MepSegmentClickPoint = Readonly<Point2D & { z?: number }>;
import type { MepSegmentDomain, MepSegmentEntity } from '../../bim/types/mep-segment-types';
import {
  completeMepSegmentFromTwoClicks,
  type MepSegmentParamOverrides,
  type SceneUnits,
} from './mep-segment-completion';
import { EventBus } from '../../systems/events/EventBus';

// ─── State machine types ─────────────────────────────────────────────────────

export type MepSegmentToolPhase =
  | 'idle'
  | 'awaitingStart'
  | 'awaitingEnd';

export interface MepSegmentToolState {
  readonly phase: MepSegmentToolPhase;
  readonly domain: MepSegmentDomain;
  readonly startPoint: Point2D | null;
  /**
   * mm — elevation inherited from a connector the START click snapped to
   * (ADR-408 Φ-B1 connector-mate). `null` ⇒ start was a free point.
   */
  readonly startElevationMm: number | null;
  readonly overrides: MepSegmentParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: MepSegmentToolState = {
  phase: 'idle',
  domain: 'duct',
  startPoint: null,
  startElevationMm: null,
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseMepSegmentToolOptions {
  /** Callback fired after successful entity build. Caller appends to scene + broadcasts. */
  readonly onSegmentCreated?: (entity: MepSegmentEntity) => void;
  /** Layer ID written on the new segment entity. */
  readonly currentLevelId?: string;
  /** Returns the active scene's coordinate units for threshold scaling. */
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseMepSegmentToolResult {
  readonly state: MepSegmentToolState;
  activate(): void;
  deactivate(): void;
  reset(): void;
  /** Returns true when the click committed a new segment or advanced the FSM. */
  onCanvasClick(point: MepSegmentClickPoint): boolean;
  /** Switch active domain. Resets the FSM, preserves overrides. */
  setDomain(domain: MepSegmentDomain): void;
  /** Ribbon / Dynamic Input overrides (section dims / elevation / material). */
  setParamOverrides(overrides: MepSegmentParamOverrides): void;
  /** Status text i18n key for status-bar / Dynamic Input prompt. */
  getStatusText(): string;
  /**
   * Live ghost axis [start, cursor] for plan-view overlay, or null when not
   * awaiting an endpoint. Pure projection — no state mutation (ADR-040).
   */
  getGhostSegment(cursor: Readonly<Point2D> | null): readonly [Point2D, Point2D] | null;
  readonly isActive: boolean;
  readonly isAwaitingStart: boolean;
  readonly isAwaitingEnd: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useMepSegmentTool(
  options: UseMepSegmentToolOptions = {},
): UseMepSegmentToolResult {
  const { onSegmentCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<MepSegmentToolState>(INITIAL_STATE);
  const stateRef = useRef<MepSegmentToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;
  const onCreatedRef = useRef(onSegmentCreated);
  onCreatedRef.current = onSegmentCreated;

  // ── lifecycle ────────────────────────────────────────────────────────────

  const activate = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      domain: prev.domain,
      overrides: prev.overrides,
      phase: 'awaitingStart',
    }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      domain: prev.domain,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingStart',
    }));
  }, []);

  const setDomain = useCallback((domain: MepSegmentDomain) => {
    setState((prev) => {
      const newPhase = prev.phase === 'idle' ? 'idle' : 'awaitingStart';
      return {
        ...INITIAL_STATE,
        domain,
        overrides: prev.overrides,
        phase: newPhase,
      };
    });
  }, []);

  const setParamOverrides = useCallback((overrides: MepSegmentParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit (2nd click) ────────────────────────────────────────────────────

  const commitFromState = useCallback(
    (s: MepSegmentToolState, endPoint: MepSegmentClickPoint): boolean => {
      if (s.startPoint === null) return false;
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const result = completeMepSegmentFromTwoClicks(
        s.startPoint,
        endPoint,
        currentLevelId,
        s.domain,
        s.overrides,
        sceneUnits,
        // ADR-408 Φ-B1 connector-mate elevations (mm). Each endpoint inherits the
        // connector it snapped to; the completion applies the Revit-style cascade
        // (a free end follows the snapped end's elevation).
        s.startElevationMm,
        endPoint.z ?? null,
      );
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      const entity = result.entity;
      // Caller (useSpecialTools) is responsible for append + broadcast via
      // `addMepSegmentToScene(entity, levelManager)` — same pattern as beam.
      onCreatedRef.current?.(entity);
      setState({
        ...INITIAL_STATE,
        domain: s.domain,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId],
  );

  // ── click pipeline ───────────────────────────────────────────────────────

  const onCanvasClick = useCallback(
    (point: MepSegmentClickPoint): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      if (s.phase === 'awaitingStart') {
        setState({
          ...s,
          phase: 'awaitingEnd',
          startPoint: { x: point.x, y: point.y },
          startElevationMm: point.z ?? null,
          error: null,
        });
        return true;
      }

      if (s.phase === 'awaitingEnd' && s.startPoint !== null) {
        return commitFromState(s, point);
      }

      return false;
    },
    [commitFromState],
  );

  // ── 3D placement bridge — same commit path as 2D (zero duplication) ───────
  const onCanvasClickRef = useRef(onCanvasClick);
  onCanvasClickRef.current = onCanvasClick;
  useEffect(() => {
    return EventBus.on('bim:place-mep-segment-3d', ({ point }) => {
      onCanvasClickRef.current(point);
    });
  }, []);

  // ── status text (i18n keys) ───────────────────────────────────────────────

  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    switch (s.phase) {
      case 'awaitingStart':
        return 'tools.mepSegment.statusStart';
      case 'awaitingEnd':
        return 'tools.mepSegment.statusEnd';
      default:
        return '';
    }
  }, []);

  // ── ghost segment (plan-view axis overlay) ────────────────────────────────

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
    setDomain,
    setParamOverrides,
    getStatusText,
    getGhostSegment,
    isActive: state.phase !== 'idle',
    isAwaitingStart: state.phase === 'awaitingStart',
    isAwaitingEnd: state.phase === 'awaitingEnd',
  };
}
