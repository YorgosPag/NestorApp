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
  let state = initial;
  const listeners = new Set<(state: AddressEditorState) => void>();

  return {
    getState: () => state,
    send: (event) => {
      const next = computeNextState(state, event, config);
      if (next !== state) {
        state = next;
        listeners.forEach((l) => l(state));
      }
      return state;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset: () => {
      state = initial;
      listeners.forEach((l) => l(state));
    },
  };
}
