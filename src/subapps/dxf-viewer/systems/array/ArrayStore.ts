/**
 * ARRAY STORE — ADR-353 Sessions A2 + B2
 *
 * Module-level pub/sub store for ephemeral Array tool state.
 * Zero React state — mirrors TrimToolStore / ExtendToolStore pattern (ADR-040).
 *
 * State:
 *   inProgressParams      — params being edited during array creation/edit
 *                           (null = not editing). Used by the ribbon bridge to
 *                           expose the just-typed value before the scene
 *                           mutation propagates back.
 *   editSourceArrayId     — ID of the array whose source is currently being
 *                           edited (null = not editing).
 *   pickingCenterArrayId  — ID of the polar array currently in
 *                           interactive-center-pick mode (Phase B re-pick from
 *                           the ribbon "Pick Center" button). Null = idle.
 */

import type { ArrayParams } from './types';

// ── State ─────────────────────────────────────────────────────────────────────

export interface ArrayStoreState {
  readonly inProgressParams: ArrayParams | null;
  readonly editSourceArrayId: string | null;
  readonly pickingCenterArrayId: string | null;
}

const INITIAL: ArrayStoreState = {
  inProgressParams: null,
  editSourceArrayId: null,
  pickingCenterArrayId: null,
};

// ── Store ─────────────────────────────────────────────────────────────────────

let _state: ArrayStoreState = INITIAL;
const _listeners = new Set<() => void>();

function _notify(): void {
  _listeners.forEach((fn) => fn());
}

function _patch(partial: Partial<ArrayStoreState>): void {
  _state = { ..._state, ...partial };
  _notify();
}

export const ArrayStore = {
  getState(): ArrayStoreState {
    return _state;
  },

  subscribe(listener: () => void): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },

  setInProgressParams(params: ArrayParams): void {
    _patch({ inProgressParams: params });
  },

  clearInProgressParams(): void {
    _patch({ inProgressParams: null });
  },

  setEditSourceArrayId(id: string): void {
    _patch({ editSourceArrayId: id });
  },

  clearEditSourceArrayId(): void {
    _patch({ editSourceArrayId: null });
  },

  setPickingCenterArrayId(id: string): void {
    _patch({ pickingCenterArrayId: id });
  },

  clearPickingCenterArrayId(): void {
    _patch({ pickingCenterArrayId: null });
  },

  reset(): void {
    _state = INITIAL;
    _notify();
  },
} as const;
