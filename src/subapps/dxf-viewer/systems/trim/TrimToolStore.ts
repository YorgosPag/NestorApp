/**
 * TRIM TOOL STORE — ADR-350
 *
 * Module-level pub/sub store for the Trim command state machine.
 * Zero React state — mirrors StretchToolStore / ScaleToolStore pattern (ADR-040).
 *
 * State machine (Q1/Q2 defaults: quick mode, no extend, UCS project):
 *   IDLE → PICKING                              (quick mode)
 *   IDLE → SELECTING_EDGES → PICKING             (standard mode)
 *   PICKING ↔ FENCE / CROSSING                   (drag selection sub-modes)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md §State Machine
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  EMPTY_TRIM_WARNINGS,
  type TrimEdgeMode,
  type TrimMode,
  type TrimMultiPreview,
  type TrimPhase,
  type TrimPreviewGeom,
  type TrimProjectMode,
  type TrimWarningAggregator,
} from './trim-types';

// ── State ─────────────────────────────────────────────────────────────────────

export interface TrimToolState {
  readonly phase: TrimPhase;
  readonly mode: TrimMode;
  readonly edgeMode: TrimEdgeMode;
  readonly projectMode: TrimProjectMode;
  /** Empty array in Quick mode = "all visible entities". Populated in Standard mode. */
  readonly cuttingEdgeIds: ReadonlyArray<string>;
  /** Cursor world position last sampled by the mouse-move pipeline. */
  readonly hoverPoint: Point2D | null;
  /** Single-pick preview (under the cursor pickbox). */
  readonly hoverPreview: TrimPreviewGeom | null;
  /** Multi-pick preview (fence/crossing drag). */
  readonly dragPreview: TrimMultiPreview | null;
  /** SHIFT held → preview becomes green (EXTEND inverse, Q9 + G4). */
  readonly inverseMode: boolean;
  /** Next click deletes target instead of trimming (eRase keyword armed). */
  readonly eraseArmed: boolean;
  /** Counters flushed to a single toast on reset (G9). */
  readonly warnings: TrimWarningAggregator;
  /** Fence/crossing drag start point (set on mousedown when drag begins). */
  readonly dragStart: Point2D | null;
  /** Fence/crossing drag current point (60fps mousemove). */
  readonly dragCurrent: Point2D | null;
}

const INITIAL: TrimToolState = {
  phase: 'idle',
  mode: 'quick',
  edgeMode: 'noExtend',
  projectMode: 'ucs',
  cuttingEdgeIds: [],
  hoverPoint: null,
  hoverPreview: null,
  dragPreview: null,
  inverseMode: false,
  eraseArmed: false,
  warnings: EMPTY_TRIM_WARNINGS,
  dragStart: null,
  dragCurrent: null,
};

// ── Store ─────────────────────────────────────────────────────────────────────

let _state: TrimToolState = INITIAL;
const _listeners = new Set<() => void>();

function _notify(): void {
  _listeners.forEach((fn) => fn());
}

function _patch(partial: Partial<TrimToolState>): void {
  _state = { ..._state, ...partial };
  _notify();
}

export const TrimToolStore = {
  getState(): TrimToolState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },

  setPhase(phase: TrimPhase): void {
    _patch({ phase });
  },

  setMode(mode: TrimMode): void {
    _patch({ mode });
  },

  toggleMode(): void {
    _patch({ mode: _state.mode === 'quick' ? 'standard' : 'quick' });
  },

  setEdgeMode(edgeMode: TrimEdgeMode): void {
    _patch({ edgeMode });
  },

  toggleEdgeMode(): void {
    _patch({ edgeMode: _state.edgeMode === 'noExtend' ? 'extend' : 'noExtend' });
  },

  setProjectMode(projectMode: TrimProjectMode): void {
    _patch({ projectMode });
  },

  setCuttingEdgeIds(ids: ReadonlyArray<string>): void {
    _patch({ cuttingEdgeIds: ids });
  },

  setHoverPoint(pt: Point2D | null): void {
    _patch({ hoverPoint: pt });
  },

  setHoverPreview(preview: TrimPreviewGeom | null): void {
    _patch({ hoverPreview: preview });
  },

  setDragPreview(preview: TrimMultiPreview | null): void {
    _patch({ dragPreview: preview });
  },

  setInverseMode(inverse: boolean): void {
    if (_state.inverseMode === inverse) return;
    _patch({ inverseMode: inverse });
  },

  setEraseArmed(armed: boolean): void {
    _patch({ eraseArmed: armed });
  },

  setDrag(start: Point2D | null, current: Point2D | null): void {
    _patch({ dragStart: start, dragCurrent: current });
  },

  incrementWarning(key: keyof TrimWarningAggregator, by = 1): void {
    const next: TrimWarningAggregator = { ..._state.warnings, [key]: _state.warnings[key] + by };
    _patch({ warnings: next });
  },

  clearWarnings(): void {
    _patch({ warnings: EMPTY_TRIM_WARNINGS });
  },

  reset(): void {
    _state = INITIAL;
    _notify();
  },
} as const;
