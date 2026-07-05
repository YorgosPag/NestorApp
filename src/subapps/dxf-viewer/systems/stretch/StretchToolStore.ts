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
import { createExternalStore } from '../../stores/createExternalStore';

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

const store = createExternalStore<StretchToolState>({ ...INITIAL }, { equals: Object.is });

function _patch(partial: Partial<StretchToolState>): void {
  store.set({ ...store.get(), ...partial });
}

export const StretchToolStore = {
  getState(): StretchToolState {
    return store.get();
  },

  subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  },

  setPhase(phase: StretchPhase): void {
    _patch({ phase, numericBuffer: '' });
  },

  setMode(mode: StretchMode): void {
    _patch({ mode });
  },

  setSelectionMode(selectionMode: StretchSelectionMode): void {
    _patch({ selectionMode });
  },

  addCrossingWindow(window: CrossingWindow): void {
    _patch({ crossingWindows: [...store.get().crossingWindows, window] });
  },

  setCrossingWindows(windows: ReadonlyArray<CrossingWindow>): void {
    _patch({ crossingWindows: windows });
  },

  setCaptured(vertices: ReadonlyArray<VertexRef>, entities: ReadonlyArray<string>): void {
    _patch({ capturedVertices: vertices, capturedEntities: entities });
  },

  setBasePoint(pt: Point2D | null): void {
    _patch({ basePoint: pt });
  },

  appendBuffer(ch: string): void {
    _patch({ numericBuffer: store.get().numericBuffer + ch });
  },

  backspaceBuffer(): void {
    _patch({ numericBuffer: store.get().numericBuffer.slice(0, -1) });
  },

  clearBuffer(): void {
    _patch({ numericBuffer: '' });
  },

  reset(): void {
    store.set({ ...INITIAL });
  },
} as const;
