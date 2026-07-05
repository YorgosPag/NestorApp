/**
 * CHAMFER TOOL STORE — ADR-510 Φ4f
 *
 * Module-level pub/sub store for the CHAMFER state machine. Zero React state —
 * mirrors FilletToolStore (ADR-040). Keyboard digits set BOTH distances equally
 * (the AutoCAD default symmetric bevel); the ribbon «Απ.2» / «Γωνία» fields set
 * d2 / angle independently. The live bevel is recomputed each frame in the preview.
 *
 *   picking-first → (pick line 1) → picking-second → (pick line 2) → picking-first …
 *   polyline mode → (pick polyline) → bevel all corners → picking-first …
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4f
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  CHAMFER_DEFAULT_DISTANCE,
  CHAMFER_DEFAULT_ANGLE,
  type ChamferFirstEntity,
  type ChamferMode,
  type ChamferPhase,
  type ChamferToolState,
} from './chamfer-types';
import { createExternalStore } from '../../stores/createExternalStore';

const INITIAL: ChamferToolState = {
  phase: 'picking-first',
  first: null,
  firstPick: null,
  d1: CHAMFER_DEFAULT_DISTANCE,
  d2: CHAMFER_DEFAULT_DISTANCE,
  angle: CHAMFER_DEFAULT_ANGLE,
  mode: 'distance',
  trim: true, // AutoCAD CHAMFER default = Trim
  polylineMode: false,
  typedBuffer: '',
  typedTarget: 'distance',
  lastD1: CHAMFER_DEFAULT_DISTANCE,
  lastD2: CHAMFER_DEFAULT_DISTANCE,
};

// ── Store ──────────────────────────────────────────────────────────────────────
// Reducer-over-single-object στο SSoT `createExternalStore` primitive
// (`equals: Object.is` = identity guard· `_patch` παράγει νέο object → notify πάντα).

const store = createExternalStore<ChamferToolState>(INITIAL, { equals: Object.is });

function _patch(partial: Partial<ChamferToolState>): void {
  store.set({ ...store.get(), ...partial });
}

export const ChamferToolStore = {
  getState(): ChamferToolState {
    return store.get();
  },

  subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  },

  setPhase(phase: ChamferPhase): void {
    _patch({ phase });
  },

  /** Commit the first picked entity (line/polyline) and advance to second-pick. */
  setFirst(first: ChamferFirstEntity, firstPick: Point2D): void {
    _patch({ first, firstPick, phase: 'picking-second' });
  },

  /** Back to first-line picking (keeps distances / angle / trim / mode). */
  clearFirst(): void {
    _patch({ first: null, firstPick: null, phase: 'picking-first' });
  },

  /** Distance mode — d1 only (ribbon «Απ.1»). */
  setD1(d1: number): void {
    if (Number.isFinite(d1) && d1 >= 0) _patch({ d1, mode: 'distance' });
  },

  /** Distance mode — d2 only (ribbon «Απ.2»). */
  setD2(d2: number): void {
    if (Number.isFinite(d2) && d2 >= 0) _patch({ d2, mode: 'distance' });
  },

  /** Angle mode — chamfer angle from line 1 (ribbon «Γωνία»). */
  setAngle(angle: number): void {
    if (Number.isFinite(angle) && angle > 0 && angle < 180) _patch({ angle, mode: 'angle' });
  },

  setMode(mode: ChamferMode): void {
    _patch({ mode, typedTarget: mode === 'angle' ? 'angle' : 'distance', typedBuffer: '' });
  },

  /** Append a digit / decimal to the buffer, routed to the active target (distance→d1=d2, angle). */
  appendTypedChar(ch: string): void {
    const state = store.get();
    if (ch === '.' && state.typedBuffer.includes('.')) return;
    const buffer = state.typedBuffer + ch;
    const parsed = parseFloat(buffer);
    if (!(Number.isFinite(parsed) && parsed >= 0)) {
      _patch({ typedBuffer: buffer });
      return;
    }
    if (state.typedTarget === 'angle') _patch({ typedBuffer: buffer, angle: parsed, mode: 'angle' });
    else _patch({ typedBuffer: buffer, d1: parsed, d2: parsed, mode: 'distance' }); // symmetric quick-entry
  },

  /** Backspace one character; empties the buffer → values keep their last state. */
  popTypedChar(): void {
    _patch({ typedBuffer: store.get().typedBuffer.slice(0, -1) });
  },

  clearTyped(): void {
    _patch({ typedBuffer: '' });
  },

  setTrim(trim: boolean): void {
    _patch({ trim });
  },

  toggleTrim(): void {
    _patch({ trim: !store.get().trim });
  },

  togglePolylineMode(): void {
    _patch({ polylineMode: !store.get().polylineMode, first: null, firstPick: null, phase: 'picking-first' });
  },

  setLastDistances(d1: number, d2: number): void {
    _patch({ lastD1: d1, lastD2: d2 });
  },

  reset(): void {
    // Preserve the user's distance/angle/trim/mode preferences across re-activations.
    const state = store.get();
    store.set({
      ...INITIAL,
      d1: state.d1, d2: state.d2, angle: state.angle, mode: state.mode,
      trim: state.trim, polylineMode: state.polylineMode,
      lastD1: state.lastD1, lastD2: state.lastD2,
    });
  },
} as const;
