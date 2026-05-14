/**
 * SCALE TOOL STORE — ADR-348
 *
 * Module-level pub/sub store for scale tool state machine.
 * Zero React state — follows HoverStore / LassoFreehandStore pattern (ADR-040).
 *
 * @see ADR-348 §Scale Tool Store
 * @see ADR-040 micro-leaf subscriber pattern
 */

import type { Point2D } from '../../rendering/types/Types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScalePhase = 'idle' | 'selecting' | 'base_point' | 'scale_input';

export type ScaleSubPhase =
  | 'direct'
  | 'direct_x'
  | 'direct_y'
  | 'ref_p1_x' | 'ref_p2_x' | 'ref_new_x'
  | 'ref_p1_y' | 'ref_p2_y' | 'ref_new_y';

export interface ScaleToolState {
  phase: ScalePhase;
  subPhase: ScaleSubPhase;
  nonUniformMode: boolean;
  selectedEntityIds: string[];
  basePoint: Point2D | null;
  refP1x: Point2D | null;
  refP2x: Point2D | null;
  refP1y: Point2D | null;
  refP2y: Point2D | null;
  currentSx: number;
  currentSy: number;
  copyMode: boolean;
  numericBuffer: string;
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL: ScaleToolState = {
  phase: 'idle',
  subPhase: 'direct',
  nonUniformMode: false,
  selectedEntityIds: [],
  basePoint: null,
  refP1x: null,
  refP2x: null,
  refP1y: null,
  refP2y: null,
  currentSx: 1,
  currentSy: 1,
  copyMode: false,
  numericBuffer: '',
};

// ── Store (module-level) ──────────────────────────────────────────────────────

let _state: ScaleToolState = { ...INITIAL };
const _listeners = new Set<() => void>();

function _notify(): void {
  _listeners.forEach(fn => fn());
}

export const ScaleToolStore = {
  getState(): ScaleToolState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },

  setPhase(phase: ScalePhase, subPhase: ScaleSubPhase = 'direct'): void {
    _state = { ..._state, phase, subPhase, numericBuffer: '' };
    _notify();
  },

  setSubPhase(subPhase: ScaleSubPhase): void {
    _state = { ..._state, subPhase, numericBuffer: '' };
    _notify();
  },

  setBasePoint(pt: Point2D | null): void {
    _state = { ..._state, basePoint: pt };
    _notify();
  },

  setRefPoint(
    key: 'refP1x' | 'refP2x' | 'refP1y' | 'refP2y',
    pt: Point2D | null,
  ): void {
    _state = { ..._state, [key]: pt };
    _notify();
  },

  setFactors(sx: number, sy: number): void {
    _state = { ..._state, currentSx: sx, currentSy: sy };
    _notify();
  },

  setCopyMode(on: boolean): void {
    _state = { ..._state, copyMode: on };
    _notify();
  },

  setNonUniformMode(on: boolean): void {
    _state = { ..._state, nonUniformMode: on };
    _notify();
  },

  setSelectedEntityIds(ids: string[]): void {
    _state = { ..._state, selectedEntityIds: ids };
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
