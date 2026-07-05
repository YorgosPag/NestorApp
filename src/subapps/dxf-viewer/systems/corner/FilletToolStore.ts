/**
 * FILLET TOOL STORE — ADR-510 Φ4e
 *
 * Module-level pub/sub store for the FILLET state machine. Zero React state —
 * mirrors OffsetToolStore (ADR-040). The live ghost is recomputed each frame in
 * the preview draw callback (from `first` line + hovered line + radius), so no
 * preview geometry is cached here.
 *
 *   picking-first → (pick line 1) → picking-second → (pick line 2) → picking-first …
 *   polyline mode → (pick polyline) → commit all corners → picking-first …
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4e
 */

import type { Point2D } from '../../rendering/types/Types';
import { FILLET_DEFAULT_RADIUS, type FilletFirstEntity, type FilletPhase, type FilletToolState } from './fillet-types';
import { createExternalStore } from '../../stores/createExternalStore';

const INITIAL: FilletToolState = {
  phase: 'picking-first',
  first: null,
  firstPick: null,
  radius: FILLET_DEFAULT_RADIUS,
  trim: true, // AutoCAD FILLET default = Trim
  polylineMode: false,
  typedBuffer: '',
  lastRadius: FILLET_DEFAULT_RADIUS,
};

// ── Store ──────────────────────────────────────────────────────────────────────

const store = createExternalStore<FilletToolState>(INITIAL, { equals: Object.is });

function _patch(partial: Partial<FilletToolState>): void {
  store.set({ ...store.get(), ...partial });
}

export const FilletToolStore = {
  getState(): FilletToolState {
    return store.get();
  },

  subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  },

  setPhase(phase: FilletPhase): void {
    _patch({ phase });
  },

  /** Commit the first picked entity (line/arc/circle) and advance to second-pick. */
  setFirst(first: FilletFirstEntity, firstPick: Point2D): void {
    _patch({ first, firstPick, phase: 'picking-second' });
  },

  /** Back to first-line picking (keeps radius / trim / mode). */
  clearFirst(): void {
    _patch({ first: null, firstPick: null, phase: 'picking-first' });
  },

  setRadius(radius: number): void {
    if (Number.isFinite(radius) && radius >= 0) _patch({ radius });
  },

  /** Append a digit / decimal to the numeric-radius buffer and mirror it live. */
  appendTypedChar(ch: string): void {
    const state = store.get();
    if (ch === '.' && state.typedBuffer.includes('.')) return;
    const buffer = state.typedBuffer + ch;
    const parsed = parseFloat(buffer);
    _patch({ typedBuffer: buffer, radius: Number.isFinite(parsed) && parsed >= 0 ? parsed : state.radius });
  },

  /** Backspace one character; empties the buffer → radius keeps its last value. */
  popTypedChar(): void {
    const state = store.get();
    const buffer = state.typedBuffer.slice(0, -1);
    const parsed = parseFloat(buffer);
    _patch({ typedBuffer: buffer, radius: buffer.length > 0 && Number.isFinite(parsed) && parsed >= 0 ? parsed : state.radius });
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

  setLastRadius(radius: number): void {
    _patch({ lastRadius: radius });
  },

  reset(): void {
    // Preserve the user's radius/trim/mode preferences across re-activations.
    const state = store.get();
    store.set({ ...INITIAL, radius: state.radius, lastRadius: state.lastRadius, trim: state.trim, polylineMode: state.polylineMode });
  },
} as const;
