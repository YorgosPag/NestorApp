// ADR-357 Phase 14-A — Command Line Store SSoT.
// Controls visibility and buffer of the command line input widget.
// Singleton, zero React. Pattern: DynamicInputLockStore.

export interface CommandLineState {
  readonly visible: boolean;
  /** Pending char captured from canvas keyboard — consumed once by CommandLineInput. */
  readonly pendingChar: string;
}

const INITIAL: CommandLineState = { visible: false, pendingChar: '' };

let _state: CommandLineState = INITIAL;
let _snapshot: CommandLineState = INITIAL;
const _subs = new Set<() => void>();

function _notify(): void {
  _snapshot = { ..._state };
  _subs.forEach(cb => cb());
}

export const CommandLineStore = {
  /** Show the command line, optionally seeding it with an initial character. */
  show(pendingChar = ''): void {
    if (_state.visible && _state.pendingChar === pendingChar) return;
    _state = { visible: true, pendingChar };
    _notify();
  },

  /** Hide the command line and clear the buffer. */
  hide(): void {
    if (!_state.visible && !_state.pendingChar) return;
    _state = INITIAL;
    _notify();
  },

  /** Called by CommandLineInput once it has consumed the pending char. */
  clearPendingChar(): void {
    if (!_state.pendingChar) return;
    _state = { ..._state, pendingChar: '' };
    _notify();
  },

  isVisible(): boolean {
    return _state.visible;
  },

  /** useSyncExternalStore interface */
  subscribe(cb: () => void): () => void {
    _subs.add(cb);
    return () => { _subs.delete(cb); };
  },

  getSnapshot(): CommandLineState {
    return _snapshot;
  },
};
