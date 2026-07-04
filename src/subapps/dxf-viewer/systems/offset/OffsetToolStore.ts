/**
 * OFFSET TOOL STORE — ADR-510 Φ4d
 *
 * Module-level pub/sub store for the OFFSET state machine. Zero React state —
 * mirrors TrimToolStore / StretchToolStore (ADR-040). Simpler than trim: the
 * «άμεσο» UX has just two phases and the live ghost is recomputed each frame in
 * the preview draw callback (from `source` + cursor), so no preview geometry is
 * cached here.
 *
 *   picking-source → (pick entity) → picking-side → (click) → picking-source …
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4d
 */

import type { Entity } from '../../types/entities';
import type { OffsetPhase, OffsetToolState } from './offset-types';

const INITIAL: OffsetToolState = {
  phase: 'picking-source',
  source: null,
  typedDistance: null,
  typedBuffer: '',
  eraseSource: false,
  lastDistance: 0,
};

// ── Store ──────────────────────────────────────────────────────────────────────

let _state: OffsetToolState = INITIAL;
const _listeners = new Set<() => void>();

function _notify(): void {
  _listeners.forEach((fn) => fn());
}

function _patch(partial: Partial<OffsetToolState>): void {
  _state = { ..._state, ...partial };
  _notify();
}

export const OffsetToolStore = {
  getState(): OffsetToolState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },

  setPhase(phase: OffsetPhase): void {
    _patch({ phase });
  },

  /** Commit the picked source and advance to side-picking. */
  setSource(source: Entity | null): void {
    _patch({ source, phase: source ? 'picking-side' : 'picking-source' });
  },

  /** Back to source-picking, clearing any typed distance (keeps lastDistance/erase). */
  clearSource(): void {
    _patch({ source: null, phase: 'picking-source', typedDistance: null, typedBuffer: '' });
  },

  setTypedDistance(distance: number | null): void {
    _patch({ typedDistance: distance });
  },

  /** Append a digit / decimal point to the numeric-entry buffer and mirror it live. */
  appendTypedChar(ch: string): void {
    if (ch === '.' && _state.typedBuffer.includes('.')) return;
    const buffer = _state.typedBuffer + ch;
    const parsed = parseFloat(buffer);
    _patch({ typedBuffer: buffer, typedDistance: Number.isFinite(parsed) && parsed > 0 ? parsed : _state.typedDistance });
  },

  /** Backspace one character; empties the buffer → distance falls back to cursor-driven. */
  popTypedChar(): void {
    const buffer = _state.typedBuffer.slice(0, -1);
    const parsed = parseFloat(buffer);
    _patch({ typedBuffer: buffer, typedDistance: buffer.length > 0 && Number.isFinite(parsed) && parsed > 0 ? parsed : null });
  },

  clearTyped(): void {
    _patch({ typedBuffer: '', typedDistance: null });
  },

  setEraseSource(erase: boolean): void {
    _patch({ eraseSource: erase });
  },

  toggleEraseSource(): void {
    _patch({ eraseSource: !_state.eraseSource });
  },

  setLastDistance(distance: number): void {
    _patch({ lastDistance: distance });
  },

  reset(): void {
    _state = INITIAL;
    _notify();
  },
} as const;
