/**
 * =============================================================================
 * ADDRESS EDITOR — State Machine (ADR-332 Phase 1, Layer 3)
 * =============================================================================
 *
 * Public surface of the address-editor state machine. Composes the pure
 * `computeNextState` reducer with sensible defaults and exposes a small
 * factory for tests/hooks that want a stateful instance.
 *
 * No React. No browser globals. 100% testable.
 *
 * @module components/shared/addresses/editor/state/addressEditorMachine
 * @see ADR-332 §3 Architecture, Layer 3
 */

import type { AddressEditorEvent, AddressEditorState } from '../types';
import {
  DEFAULT_CONFIG,
  buildFreshness,
  computeNextState,
  type MachineConfig,
} from './transitions';
import { createExternalStore } from '@/lib/state/createExternalStore';

export const INITIAL_STATE: AddressEditorState = { phase: 'idle' };

export { DEFAULT_CONFIG, buildFreshness, computeNextState };
export type { MachineConfig };

/**
 * Pure reducer entry point. Identical to `computeNextState` — re-exported under
 * a reducer-friendly name so consumers can drop it into `useReducer`.
 */
export function reduce(
  state: AddressEditorState,
  event: AddressEditorEvent,
  config: MachineConfig = DEFAULT_CONFIG,
): AddressEditorState {
  return computeNextState(state, event, config);
}

export interface AddressEditorMachine {
  getState(): AddressEditorState;
  send(event: AddressEditorEvent): AddressEditorState;
  subscribe(listener: (state: AddressEditorState) => void): () => void;
  reset(): void;
}

/**
 * Factory for a stateful machine instance — useful in non-React contexts
 * (vanilla JS scripts, Node, or hooks that prefer manual subscription).
 * React hooks will typically use `reduce` with `useReducer` directly.
 */
export function createAddressEditorMachine(
  config: MachineConfig = DEFAULT_CONFIG,
  initial: AddressEditorState = INITIAL_STATE,
): AddressEditorMachine {
  // SSoT pub/sub primitive (WAVE 3). No `equals`: `send` keeps its own `next !== prev`
  // identity guard (a no-op transition never notifies), while `reset()` — a public
  // runtime API — force-notifies with the initial state even when unchanged. Payload
  // subscribers get the current state via the wrapper.
  const store = createExternalStore<AddressEditorState>(initial);

  return {
    getState: () => store.get(),
    send: (event) => {
      const prev = store.get();
      const next = computeNextState(prev, event, config);
      if (next !== prev) store.set(next);
      return store.get();
    },
    subscribe: (listener) => store.subscribe(() => listener(store.get())),
    reset: () => store.set(initial),
  };
}
