// ADR-357 Phase 14-A — Command History Store SSoT.
// Singleton, zero React. Pattern: DynamicInputLockStore.
// Persists to localStorage (key: dxf:commandHistory), max 100 entries.

const LS_KEY = 'dxf:commandHistory';
const MAX_ENTRIES = 100;

interface HistoryState {
  readonly entries: readonly string[];
  readonly navIndex: number; // -1 = not navigating; 0 = most recent
}

const INITIAL: HistoryState = { entries: [], navIndex: -1 };

let _state: HistoryState = _loadFromStorage();
let _snapshot: HistoryState = _state;
const _subs = new Set<() => void>();

function _loadFromStorage(): HistoryState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      return { entries: Array.isArray(parsed) ? parsed : [], navIndex: -1 };
    }
  } catch {
    // ignore
  }
  return INITIAL;
}

function _persist(entries: readonly string[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

function _notify(): void {
  _snapshot = { ..._state };
  _subs.forEach(cb => cb());
}

export const CommandHistoryStore = {
  /** Add a command to history (deduplicates consecutive identical entries). */
  push(cmd: string): void {
    const trimmed = cmd.trim().toUpperCase();
    if (!trimmed) return;

    const current = [..._state.entries];
    if (current[0] === trimmed) {
      // Same as most recent — reset nav only
      _state = { entries: current, navIndex: -1 };
      _notify();
      return;
    }

    const updated = [trimmed, ...current].slice(0, MAX_ENTRIES);
    _persist(updated);
    _state = { entries: updated, navIndex: -1 };
    _notify();
  },

  /**
   * Navigate backwards (older commands).
   * Returns the entry at the new position, or null if at limit.
   */
  navigateUp(): string | null {
    const { entries, navIndex } = _state;
    if (entries.length === 0) return null;
    const next = Math.min(navIndex + 1, entries.length - 1);
    _state = { entries, navIndex: next };
    _notify();
    return entries[next] ?? null;
  },

  /**
   * Navigate forwards (newer commands).
   * Returns the entry at the new position, or '' when past the newest.
   */
  navigateDown(): string {
    const { entries, navIndex } = _state;
    if (navIndex <= 0) {
      _state = { entries, navIndex: -1 };
      _notify();
      return '';
    }
    const next = navIndex - 1;
    _state = { entries, navIndex: next };
    _notify();
    return entries[next] ?? '';
  },

  /** Reset navigation cursor (call when user starts typing). */
  resetNavigation(): void {
    if (_state.navIndex === -1) return;
    _state = { ..._state, navIndex: -1 };
    _notify();
  },

  /** Get all history entries (most recent first). */
  getEntries(): readonly string[] {
    return _state.entries;
  },

  /** useSyncExternalStore interface */
  subscribe(cb: () => void): () => void {
    _subs.add(cb);
    return () => { _subs.delete(cb); };
  },

  getSnapshot(): HistoryState {
    return _snapshot;
  },
};
