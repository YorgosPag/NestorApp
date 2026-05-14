/**
 * STRETCH TOOL STORE — ADR-349
 *
 * Module-level pub/sub store for stretch tool state machine.
 * Zero React state — follows ScaleToolStore / HoverStore pattern (ADR-040).
 *
 * State machine:
 *   IDLE → SELECTING → BASE_POINT → DISPLACEMENT → DONE
 *
 * Shared SSoT for STRETCH (single crossing window) and MSTRETCH (multi-window union).
 *
 * @see ADR-349 §Stretch Tool Store
 * @see ADR-348 ScaleToolStore for the pattern this mirrors
 */

import type { Point2D } from '../../rendering/types/Types';
import type { VertexRef } from './stretch-vertex-classifier';

// ── Types ─────────────────────────────────────────────────────────────────────

export type StretchPhase = 'idle' | 'selecting' | 'base_point' | 'displacement' | 'done';

export type StretchMode = 'single' | 'multi';

export type StretchSelectionMode = 'crossing-window' | 'pre-selected';

/**
 * Axis-aligned crossing window in world coordinates.
 * Captured by drag right-to-left (industry standard).
 */
export interface CrossingWindow {
  readonly min: Point2D;
  readonly max: Point2D;
}

export interface StretchToolState {
  phase: StretchPhase;
  mode: StretchMode;
  selectionMode: StretchSelectionMode;
  crossingWindows: ReadonlyArray<CrossingWindow>;
  /** Computed from crossingWindows once selection confirmed */
  capturedVertices: ReadonlyArray<VertexRef>;
  /** Entities whose anchor (center/insertion) is inside any window → rigid move */
  capturedEntities: ReadonlyArray<string>;
  basePoint: Point2D | null;
  numericBuffer: string;
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL: StretchToolState = {
  phase: 'idle',
  mode: 'single',
  selectionMode: 'crossing-window',
  crossingWindows: [],
  capturedVertices: [],
  capturedEntities: [],
  basePoint: null,
  numericBuffer: '',
};

// ── Store (module-level) ──────────────────────────────────────────────────────

let _state: StretchToolState = { ...INITIAL };
const _listeners = new Set<() => void>();

function _notify(): void {
  _listeners.forEach(fn => fn());
}

export const StretchToolStore = {
  getState(): StretchToolState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },

  setPhase(phase: StretchPhase): void {
    _state = { ..._state, phase, numericBuffer: '' };
    _notify();
  },

  setMode(mode: StretchMode): void {
    _state = { ..._state, mode };
    _notify();
  },

  setSelectionMode(selectionMode: StretchSelectionMode): void {
    _state = { ..._state, selectionMode };
    _notify();
  },

  addCrossingWindow(window: CrossingWindow): void {
    _state = { ..._state, crossingWindows: [..._state.crossingWindows, window] };
    _notify();
  },

  setCrossingWindows(windows: ReadonlyArray<CrossingWindow>): void {
    _state = { ..._state, crossingWindows: windows };
    _notify();
  },

  setCaptured(vertices: ReadonlyArray<VertexRef>, entities: ReadonlyArray<string>): void {
    _state = { ..._state, capturedVertices: vertices, capturedEntities: entities };
    _notify();
  },

  setBasePoint(pt: Point2D | null): void {
    _state = { ..._state, basePoint: pt };
    _notify();
  },

  appendBuffer(ch: string): void {
    _state = { ..._state, numericBuffer: _state.numericBuffer + ch };
    _notify();
  },

  backspaceBuffer(): void {
    _state = { ..._state, numericBuffer: _state.numericBuffer.slice(0, -1) };
    _notify();
  },

  clearBuffer(): void {
    _state = { ..._state, numericBuffer: '' };
    _notify();
  },

  reset(): void {
    _state = { ...INITIAL };
    _notify();
  },
} as const;
