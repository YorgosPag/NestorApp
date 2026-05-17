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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { StairEntity } from '../../types/stair';
import { stairStatusStore } from '../../statusbar/stair-status-store';
import { stairPreviewStore } from '../../systems/stairs/stair-preview-store';
import type { DynamicSubmitDetail } from '../../systems/dynamic-input/utils/events';
import {
  buildDefaultStairParams,
  buildStairEntity,
  directionFromPoints,
  type SceneUnits,
  type StairFloorLinkInput,
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
  /**
   * ADR-358 Phase 8 — scene units getter (called at commit time so the
   * builder converts the mm-baked defaults into the active scene's units).
   * Defaults to `'mm'` when omitted (back-compat).
   */
  readonly getSceneUnits?: () => SceneUnits;
  /**
   * ADR-358 Phase 9 — Q17 floor link resolver. Called at commit time so the
   * builder can seed `multiStoryConfig` with the building floor's height
   * (mm) and `linkedToFloor = true`. Returns `null` when no floor is in
   * scope (e.g. building-level DXF or wizard project root); the builder
   * then leaves `multiStoryConfig` undefined (Phase 7a behavior).
   */
  readonly getFloorLink?: () => StairFloorLinkInput | null;
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
  const { onStairCreated, currentLevelId = '0', getSceneUnits, getFloorLink } = options;

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
    const sceneUnits = getSceneUnits?.() ?? 'mm';
    const floorLink = getFloorLink?.() ?? null;
    const params = buildDefaultStairParams(
      s.basePoint,
      s.direction,
      s.overrides,
      sceneUnits,
      floorLink,
    );
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
  }, [currentLevelId, onStairCreated, getSceneUnits, getFloorLink]);

  const confirm = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.phase !== 'confirming') return false;
    return commitFromState(s);
  }, [commitFromState]);

  /**
   * ADR-358 Phase 7b2b-β Stream E — commit with inline Dynamic Input overrides
   * applied atomically (bypasses async setState batching). Called by the
   * `commit-stair` event listener below.
   */
  const confirmWithOverrides = useCallback(
    (overrides: StairParamOverrides): boolean => {
      const s = stateRef.current;
      if (s.phase !== 'confirming') return false;
      return commitFromState({
        ...s,
        overrides: { ...s.overrides, ...overrides },
      });
    },
    [commitFromState],
  );

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

  // ── ADR-358 Phase 7b1 — publish current status key to CadStatusBar.
  // Single writer (this hook), multi reader (useStairStatusKey).
  useEffect(() => {
    switch (state.phase) {
      case 'awaitingBasePoint': stairStatusStore.set('tools.stair.statusBasePoint'); break;
      case 'awaitingDirection': stairStatusStore.set('tools.stair.statusDirection'); break;
      case 'confirming': stairStatusStore.set('tools.stair.statusConfirm'); break;
      default: stairStatusStore.set(null);
    }
  }, [state.phase]);

  // ── ADR-358 Phase 8 (preview hotfix) — publish current basePoint+direction
  // to `stairPreviewStore` so `useUnifiedDrawing.updatePreview` can render the
  // ghost rubber-band / walkline preview. The stair tool's state machine is
  // intentionally NOT routed through `machineContext.points`, so a dedicated
  // SSoT store is the cleanest cross-hook bridge.
  useEffect(() => {
    if (state.phase === 'idle') {
      stairPreviewStore.reset();
      return;
    }
    stairPreviewStore.set({
      basePoint: state.basePoint,
      direction: state.direction,
    });
  }, [state.phase, state.basePoint, state.direction]);

  // Separate unmount-only cleanup so the per-phase effects above do not
  // emit a transient `null` between phase transitions.
  useEffect(() => {
    return () => {
      stairStatusStore.set(null);
      stairPreviewStore.reset();
    };
  }, []);

  // ADR-358 Phase 7b2b-β Stream E — listen for `commit-stair` events emitted
  // by the Dynamic Input overlay (rise/tread/width inline editor). Applies
  // the inline overrides + confirms the placement atomically.
  useEffect(() => {
    const onDynSubmit = (e: Event) => {
      const ce = e as CustomEvent<DynamicSubmitDetail>;
      if (!ce.detail || ce.detail.action !== 'commit-stair' || ce.detail.tool !== 'stair') return;
      const overrides: StairParamOverrides = {
        ...(typeof ce.detail.rise === 'number' ? { rise: ce.detail.rise } : {}),
        ...(typeof ce.detail.tread === 'number' ? { tread: ce.detail.tread } : {}),
        ...(typeof ce.detail.width === 'number' ? { width: ce.detail.width } : {}),
      };
      confirmWithOverrides(overrides);
    };
    window.addEventListener('dynamic-input-coordinate-submit', onDynSubmit);
    return () => window.removeEventListener('dynamic-input-coordinate-submit', onDynSubmit);
  }, [confirmWithOverrides]);

  // ADR-358 Phase 8 (Enter commit hotfix) — direct Enter listener as a safety
  // net so the tool commits even when the Dynamic Input overlay is disabled
  // (`settings.behavior.dynamic_input === false`) or temporarily unmounted.
  // The Dynamic Input path remains the preferred route when active because it
  // can attach inline rise/tread/width overrides; here we just commit with
  // current state defaults. Capture phase so we win against any unrelated
  // global handler; we only act when phase === 'confirming'.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (stateRef.current.phase !== 'confirming') return;
      // Do not double-fire when Dynamic Input also dispatches a commit-stair.
      // If the active element is an input (Dynamic Input field), let the
      // overlay handler win via `dynamic-input-coordinate-submit`.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      confirm();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [confirm]);

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
