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
import { createExternalStore } from '../../stores/createExternalStore';

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
  /** First real cursor sample after the base point — the drag reference (factor 1). ADR-646 #1. */
  dragRefPoint: Point2D | null;
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
  dragRefPoint: null,
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

const store = createExternalStore<ScaleToolState>({ ...INITIAL }, { equals: Object.is });

function _patch(partial: Partial<ScaleToolState>): void {
  store.set({ ...store.get(), ...partial });
}

// ── Commit sink (ADR-646 Φ4 #6) ─────────────────────────────────────────────────
// The ribbon «Συντελεστής» field commits a uniform scale, but the actual executor
// (`executeScale`) lives in the `useScaleTool` hook — it needs the scene-manager +
// command history the store has no access to. The hook registers its executor here
// on activate (clears it on deactivate); the ribbon bridge invokes it via
// `commitUniformScale`. Kept OUTSIDE the reactive `store` state so registering the
// sink never notifies the ADR-040 leaf subscribers (zero render churn).
type ScaleCommitSink = (sx: number, sy: number) => void;
let commitSink: ScaleCommitSink | null = null;

export const ScaleToolStore = {
  getState(): ScaleToolState {
    return store.get();
  },

  subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  },

  setPhase(phase: ScalePhase, subPhase: ScaleSubPhase = 'direct'): void {
    _patch({ phase, subPhase, numericBuffer: '' });
  },

  setSubPhase(subPhase: ScaleSubPhase): void {
    _patch({ subPhase, numericBuffer: '' });
  },

  setBasePoint(pt: Point2D | null): void {
    _patch({ basePoint: pt });
  },

  setDragRefPoint(pt: Point2D | null): void {
    _patch({ dragRefPoint: pt });
  },

  setRefPoint(
    key: 'refP1x' | 'refP2x' | 'refP1y' | 'refP2y',
    pt: Point2D | null,
  ): void {
    // Full-spread with computed key (mirrors the original assignment shape so the
    // union-typed key stays assignable to ScaleToolState — no index-signature widening).
    store.set({ ...store.get(), [key]: pt });
  },

  setFactors(sx: number, sy: number): void {
    _patch({ currentSx: sx, currentSy: sy });
  },

  setCopyMode(on: boolean): void {
    _patch({ copyMode: on });
  },

  setNonUniformMode(on: boolean): void {
    _patch({ nonUniformMode: on });
  },

  setSelectedEntityIds(ids: string[]): void {
    _patch({ selectedEntityIds: ids });
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

  // ADR-646 Φ4 #6 — the hook registers/clears its `executeScale` executor here so
  // the ribbon «Συντελεστής» field can trigger the SAME commit path as typed-Enter.
  setCommitSink(sink: ScaleCommitSink | null): void {
    commitSink = sink;
  },

  /**
   * Ribbon «Συντελεστής» → uniform scale via the hook-registered executor. No-op
   * (harmless) if the tool is inactive or no base point has been picked yet — the
   * executor itself guards `!basePoint` and `factor === 0` (ADR-646 Φ4 #6).
   */
  commitUniformScale(factor: number): void {
    commitSink?.(factor, factor);
  },

  reset(): void {
    store.set({ ...INITIAL });
  },
} as const;
