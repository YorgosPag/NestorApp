// ADR-357 Phase 14-A — Command Line Store SSoT.
// Controls visibility and buffer of the command line input widget.
// Singleton, zero React. Pattern: DynamicInputLockStore.
// Notify plumbing delegated to the SSoT `createExternalStore` primitive.

import { createExternalStore } from '../../stores/createExternalStore';

export interface CommandLineState {
  readonly visible: boolean;
  /** Pending char captured from canvas keyboard — consumed once by CommandLineInput. */
  readonly pendingChar: string;
}

const INITIAL: CommandLineState = { visible: false, pendingChar: '' };

// `equals: Object.is` → `store.get()` referentially stable between mutations
// (useSyncExternalStore-safe getSnapshot· κάθε mutation παράγει νέο object).
const store = createExternalStore<CommandLineState>(INITIAL, { equals: Object.is });

export const CommandLineStore = {
  /** Show the command line, optionally seeding it with an initial character. */
  show(pendingChar = ''): void {
    const state = store.get();
    if (state.visible && state.pendingChar === pendingChar) return;
    store.set({ visible: true, pendingChar });
  },

  /** Hide the command line and clear the buffer. */
  hide(): void {
    const state = store.get();
    if (!state.visible && !state.pendingChar) return;
    store.set(INITIAL);
  },

  /** Called by CommandLineInput once it has consumed the pending char. */
  clearPendingChar(): void {
    const state = store.get();
    if (!state.pendingChar) return;
    store.set({ ...state, pendingChar: '' });
  },

  isVisible(): boolean {
    return store.get().visible;
  },

  /** useSyncExternalStore interface */
  subscribe(cb: () => void): () => void {
    return store.subscribe(cb);
  },

  getSnapshot(): CommandLineState {
    return store.get();
  },
};
