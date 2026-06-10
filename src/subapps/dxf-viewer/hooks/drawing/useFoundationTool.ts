/**
 * ADR-436 Slice 1 — Foundation Tool React Hook Orchestrator.
 *
 * State machine:
 *   idle → awaitingPosition → committed → awaitingPosition (continuous)
 *
 * Single-click placement (pad) — Revit Structural Foundation: Isolated. User
 * picks the Foundation tool → optional anchor cycling με Tab → click commits a
 * pad footing at the projected anchor offset. ESC reset (central EscapeCommandBus).
 * Continuous chain (mirror `useColumnTool` freehand path).
 *
 * Scope (Slice 1): ΜΟΝΟ `pad` (point-based). Τα line-based kinds (strip/tie-beam)
 * = Slice 2 (mirror `useBeamTool`). 3Δ viewport placement bridge = αργότερα (η
 * θεμελίωση σχεδιάζεται φυσικά σε 2Δ foundation-plan).
 *
 * SSoT alignment:
 *   - Entity build via `buildFoundationEntity` / `buildDefaultFoundationParams`
 *     (`hooks/drawing/foundation-completion.ts`). ZERO duplicate construction.
 *   - ADR-040 micro-leaf compliance: hook owns React state, no
 *     `useSyncExternalStore` against high-frequency stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import {
  FOUNDATION_ANCHOR_CYCLE_ORDER,
  type FoundationAnchor,
  type FoundationEntity,
  type FoundationKind,
} from '../../bim/types/foundation-types';
import {
  buildDefaultFoundationParams,
  buildFoundationEntity,
  type FoundationParamOverrides,
  type SceneUnits,
} from './foundation-completion';
import { foundationToolBridgeStore } from '../../ui/ribbon/hooks/bridge/foundation-tool-bridge-store';

// ─── State machine types ─────────────────────────────────────────────────────

export type FoundationToolPhase = 'idle' | 'awaitingPosition' | 'committed';

export interface FoundationToolState {
  readonly phase: FoundationToolPhase;
  readonly kind: FoundationKind;
  readonly anchor: FoundationAnchor;
  readonly overrides: FoundationParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: FoundationToolState = {
  phase: 'idle',
  kind: 'pad',
  anchor: 'center',
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseFoundationToolOptions {
  /** Callback fired μετά από επιτυχές build + commit. */
  readonly onFoundationCreated?: (entity: FoundationEntity) => void;
  /** Layer ID στο οποίο γράφεται η νέα foundation. */
  readonly currentLevelId?: string;
  /** Active scene coordinate units για σωστή mm→canvas conversion. */
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseFoundationToolResult {
  readonly state: FoundationToolState;
  activate(): void;
  setKind(kind: FoundationKind): void;
  setAnchor(anchor: FoundationAnchor): void;
  cycleAnchor(direction?: 1 | -1): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click commit-άρισε νέα foundation. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  setParamOverrides(overrides: FoundationParamOverrides): void;
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingPosition: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useFoundationTool(options: UseFoundationToolOptions = {}): UseFoundationToolResult {
  const { onFoundationCreated, currentLevelId = '0', getSceneUnits } = options;

  const [state, setState] = useState<FoundationToolState>(INITIAL_STATE);
  const stateRef = useRef<FoundationToolState>(state);
  stateRef.current = state;
  const getSceneUnitsRef = useRef(getSceneUnits);
  getSceneUnitsRef.current = getSceneUnits;

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      anchor: prev.anchor,
      overrides: prev.overrides,
      phase: 'awaitingPosition',
    }));
  }, []);

  const setKind = useCallback((kind: FoundationKind) => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind,
      anchor: prev.anchor,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, []);

  const setAnchor = useCallback((anchor: FoundationAnchor) => {
    setState((prev) => ({ ...prev, anchor }));
  }, []);

  const cycleAnchor = useCallback((direction: 1 | -1 = 1) => {
    setState((prev) => {
      const idx = FOUNDATION_ANCHOR_CYCLE_ORDER.indexOf(prev.anchor);
      const len = FOUNDATION_ANCHOR_CYCLE_ORDER.length;
      const nextIdx = (idx + direction + len) % len;
      return { ...prev, anchor: FOUNDATION_ANCHOR_CYCLE_ORDER[nextIdx] };
    });
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      kind: prev.kind,
      anchor: prev.anchor,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingPosition',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: FoundationParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit ───────────────────────────────────────────────────────────────
  /**
   * Build + commit foundation από clicked point. Validator hardError αναιρεί το
   * commit silently — FSM παραμένει σε awaitingPosition ώστε ο χρήστης να
   * διορθώσει (e.g. via ribbon overrides).
   */
  const commitFromState = useCallback(
    (s: FoundationToolState, clickPoint: Readonly<Point2D>): boolean => {
      const overridesWithKind: FoundationParamOverrides = {
        ...s.overrides,
        kind: s.kind,
        anchor: s.anchor,
      };
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const params = buildDefaultFoundationParams(clickPoint, s.kind, overridesWithKind, sceneUnits);
      const result = buildFoundationEntity(params, currentLevelId);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onFoundationCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        anchor: s.anchor,
        overrides: s.overrides,
        phase: 'awaitingPosition',
      });
      return true;
    },
    [currentLevelId, onFoundationCreated],
  );

  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition') return false;
      return commitFromState(s, point);
    },
    [commitFromState],
  );

  // ── status text (i18n keys returned για caller-resolved translation) ─────
  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (s.phase === 'idle') return '';
    return s.phase === 'awaitingPosition' ? 'tools.foundation.statusPosition' : '';
  }, []);

  // ── publish handle to ribbon bridge store (single writer) ────────────────
  useEffect(() => {
    const isActive = state.phase !== 'idle';
    foundationToolBridgeStore.set({
      isActive,
      kind: state.kind,
      anchor: state.anchor,
      overrides: state.overrides,
      setKind,
      setAnchor,
      setParamOverrides,
      getSceneUnits: () => getSceneUnitsRef.current?.() ?? 'mm',
    });
    return () => {
      if (foundationToolBridgeStore.get()?.setKind === setKind) {
        foundationToolBridgeStore.set(null);
      }
    };
  }, [state, setKind, setAnchor, setParamOverrides]);

  // ── Tab cycles anchor (mirror useColumnTool) ─────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const s = stateRef.current;
      if (s.phase !== 'awaitingPosition') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const direction: 1 | -1 = e.shiftKey ? -1 : 1;
      setState((prev) => {
        const idx = FOUNDATION_ANCHOR_CYCLE_ORDER.indexOf(prev.anchor);
        const len = FOUNDATION_ANCHOR_CYCLE_ORDER.length;
        const nextIdx = (idx + direction + len) % len;
        return { ...prev, anchor: FOUNDATION_ANCHOR_CYCLE_ORDER[nextIdx] };
      });
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return {
    state,
    activate,
    setKind,
    setAnchor,
    cycleAnchor,
    deactivate,
    reset,
    onCanvasClick,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
    isAwaitingPosition: state.phase === 'awaitingPosition',
  };
}
