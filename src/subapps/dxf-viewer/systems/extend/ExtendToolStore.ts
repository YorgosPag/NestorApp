/**
 * EXTEND TOOL STORE — ADR-353
 *
 * Module-level pub/sub store for the Extend command state machine.
 * Zero React state — mirrors TrimToolStore / StretchToolStore pattern (ADR-040).
 *
 * State machine (Quick mode default, EDGEMODE=0, UCS project):
 *   IDLE → PICKING                              (quick mode)
 *   IDLE → SELECTING_EDGES → PICKING             (standard mode)
 *   PICKING ↔ FENCE / CROSSING                   (drag selection sub-modes)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-353-extend-command.md §State Machine
 */

import type { Point2D } from '../../rendering/types/Types';
import { pointsEqual } from '../../rendering/entities/shared/geometry-vector-utils';
import {
  EMPTY_EXTEND_WARNINGS,
  type ExtendEdgeMode,
  type ExtendMode,
  type ExtendMultiPreview,
  type ExtendPhase,
  type ExtendPreviewGeom,
  type ExtendProjectMode,
  type ExtendWarningAggregator,
} from './extend-types';

// ── State ─────────────────────────────────────────────────────────────────────

export interface ExtendToolState {
  readonly phase: ExtendPhase;
  readonly mode: ExtendMode;
  readonly edgeMode: ExtendEdgeMode;
  readonly projectMode: ExtendProjectMode;
  /** Empty array in Quick mode = "all visible entities". Populated in Standard mode. */
  readonly boundaryEdgeIds: ReadonlyArray<string>;
  /** Cursor world position last sampled by the mouse-move pipeline. */
  readonly hoverPoint: Point2D | null;
  /** Single-pick hover preview (ghost extension from endpoint to boundary). */
  readonly hoverPreview: ExtendPreviewGeom | null;
  /** Multi-pick preview (fence/crossing drag). */
  readonly dragPreview: ExtendMultiPreview | null;
  /** SHIFT held → preview becomes red (TRIM inverse, ADR-353 Q4). */
  readonly inverseMode: boolean;
  /** Counters flushed to a single toast on reset (G11). */
  readonly warnings: ExtendWarningAggregator;
  /** Fence/crossing drag start point (set on mousedown when drag begins). */
  readonly dragStart: Point2D | null;
  /** Fence/crossing drag current point (60fps mousemove). */
  readonly dragCurrent: Point2D | null;
}

const INITIAL: ExtendToolState = {
  phase: 'idle',
  mode: 'quick',
  edgeMode: 'noExtend',
  projectMode: 'ucs',
  boundaryEdgeIds: [],
  hoverPoint: null,
  hoverPreview: null,
  dragPreview: null,
  inverseMode: false,
  warnings: EMPTY_EXTEND_WARNINGS,
  dragStart: null,
  dragCurrent: null,
};

// ── Pick function registry (avoids prop-threading through orchestrators) ──────

type PickFn = (worldPoint: Point2D, shiftKey: boolean) => void;
let _pickFn: PickFn | null = null;

// ── Fence function registry ────────────────────────────────────────────────────

type FenceFn = (fenceStart: Point2D, fenceEnd: Point2D, shiftKey: boolean) => void;
let _fenceFn: FenceFn | null = null;

// ── Fence preview function registry ───────────────────────────────────────────

type FencePreviewFn = (fenceStart: Point2D, fenceEnd: Point2D) => void;
let _fencePreviewFn: FencePreviewFn | null = null;

type HoverMoveFn = (worldPoint: Point2D, shiftKey: boolean) => void;
let _hoverMoveFn: HoverMoveFn | null = null;

// ── Store ─────────────────────────────────────────────────────────────────────

let _state: ExtendToolState = INITIAL;
const _listeners = new Set<() => void>();

function _notify(): void {
  _listeners.forEach((fn) => fn());
}

function _patch(partial: Partial<ExtendToolState>): void {
  _state = { ..._state, ...partial };
  _notify();
}

export const ExtendToolStore = {
  getState(): ExtendToolState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },

  setPhase(phase: ExtendPhase): void {
    _patch({ phase });
  },

  setMode(mode: ExtendMode): void {
    _patch({ mode });
  },

  toggleMode(): void {
    _patch({ mode: _state.mode === 'quick' ? 'standard' : 'quick' });
  },

  setEdgeMode(edgeMode: ExtendEdgeMode): void {
    _patch({ edgeMode });
  },

  toggleEdgeMode(): void {
    _patch({ edgeMode: _state.edgeMode === 'noExtend' ? 'extend' : 'noExtend' });
  },

  setProjectMode(projectMode: ExtendProjectMode): void {
    _patch({ projectMode });
  },

  setBoundaryEdgeIds(ids: ReadonlyArray<string>): void {
    _patch({ boundaryEdgeIds: ids });
  },

  setHoverPoint(pt: Point2D | null): void {
    if (pointsEqual(_state.hoverPoint, pt)) return;
    _patch({ hoverPoint: pt });
  },

  setHoverPreview(preview: ExtendPreviewGeom | null): void {
    _patch({ hoverPreview: preview });
  },

  setDragPreview(preview: ExtendMultiPreview | null): void {
    _patch({ dragPreview: preview });
  },

  setInverseMode(inverse: boolean): void {
    if (_state.inverseMode === inverse) return;
    _patch({ inverseMode: inverse });
  },

  setDrag(start: Point2D | null, current: Point2D | null): void {
    _patch({ dragStart: start, dragCurrent: current });
  },

  incrementWarning(key: keyof ExtendWarningAggregator, by = 1): void {
    const next: ExtendWarningAggregator = { ..._state.warnings, [key]: _state.warnings[key] + by };
    _patch({ warnings: next });
  },

  clearWarnings(): void {
    _patch({ warnings: EMPTY_EXTEND_WARNINGS });
  },

  /** Register the performExtendPick closure from useExtendTool. */
  registerPickFn(fn: PickFn | null): void {
    _pickFn = fn;
  },

  /** Invoke the registered pick function (used by canvas click handler). */
  execPick(worldPoint: Point2D, shiftKey: boolean): void {
    _pickFn?.(worldPoint, shiftKey);
  },

  /** Register the performFenceExtend closure from useExtendTool. */
  registerFenceFn(fn: FenceFn | null): void {
    _fenceFn = fn;
  },

  /** Invoke the registered fence function after a fence drag ends. */
  execFence(fenceStart: Point2D, fenceEnd: Point2D, shiftKey: boolean): void {
    _fenceFn?.(fenceStart, fenceEnd, shiftKey);
  },

  /** Register the computeFencePreview closure from useExtendTool. */
  registerFencePreviewFn(fn: FencePreviewFn | null): void {
    _fencePreviewFn = fn;
  },

  /** Invoke the preview fn during fence drag mousemove (throttled by caller). */
  execFencePreview(fenceStart: Point2D, fenceEnd: Point2D): void {
    _fencePreviewFn?.(fenceStart, fenceEnd);
  },

  /** Register the handleExtendMouseMove closure from useExtendTool. */
  registerHoverMoveFn(fn: HoverMoveFn | null): void {
    _hoverMoveFn = fn;
  },

  /** Invoke the hover move fn on each pointermove while in picking phase. */
  execHoverMove(worldPoint: Point2D, shiftKey: boolean): void {
    _hoverMoveFn?.(worldPoint, shiftKey);
  },

  reset(): void {
    _pickFn = null;
    _fenceFn = null;
    _fencePreviewFn = null;
    _hoverMoveFn = null;
    _state = INITIAL;
    _notify();
  },
} as const;
