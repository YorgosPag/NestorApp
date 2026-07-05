// ADR-357 Phase 14-A — Command History Store SSoT.
// Singleton, zero React. Pattern: DynamicInputLockStore.
// Persists to localStorage (key: dxf:commandHistory), max 100 entries.
// Notify plumbing delegated to the SSoT `createExternalStore` primitive.

import { createExternalStore } from '../../stores/createExternalStore';

const LS_KEY = 'dxf:commandHistory';
const MAX_ENTRIES = 100;

interface HistoryState {
  readonly entries: readonly string[];
  readonly navIndex: number; // -1 = not navigating; 0 = most recent
}

const INITIAL: HistoryState = { entries: [], navIndex: -1 };

// `equals: Object.is` → `store.get()` referentially stable between mutations
// (κάθε mutation παράγει νέο object → πραγματικές αλλαγές notify-άρουν πάντα).
const store = createExternalStore<HistoryState>(_loadFromStorage(), { equals: Object.is });

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

export const CommandHistoryStore = {
  /** Add a command to history (deduplicates consecutive identical entries). */
  push(cmd: string): void {
    const trimmed = cmd.trim().toUpperCase();
    if (!trimmed) return;

    const current = [...store.get().entries];
    if (current[0] === trimmed) {
      // Same as most recent — reset nav only
      store.set({ entries: current, navIndex: -1 });
      return;
    }

    const updated = [trimmed, ...current].slice(0, MAX_ENTRIES);
    _persist(updated);
    store.set({ entries: updated, navIndex: -1 });
  },

  /**
   * Navigate backwards (older commands).
   * Returns the entry at the new position, or null if at limit.
   */
  navigateUp(): string | null {
    const { entries, navIndex } = store.get();
    if (entries.length === 0) return null;
    const next = Math.min(navIndex + 1, entries.length - 1);
    store.set({ entries, navIndex: next });
    return entries[next] ?? null;
  },

  /**
   * Navigate forwards (newer commands).
   * Returns the entry at the new position, or '' when past the newest.
   */
  navigateDown(): string {
    const { entries, navIndex } = store.get();
    if (navIndex <= 0) {
      store.set({ entries, navIndex: -1 });
      return '';
    }
    const next = navIndex - 1;
    store.set({ entries, navIndex: next });
    return entries[next] ?? '';
  },

  /** Reset navigation cursor (call when user starts typing). */
  resetNavigation(): void {
    const state = store.get();
    if (state.navIndex === -1) return;
    store.set({ ...state, navIndex: -1 });
  },

  /** Get all history entries (most recent first). */
  getEntries(): readonly string[] {
    return store.get().entries;
  },

  /** useSyncExternalStore interface */
  subscribe(cb: () => void): () => void {
    return store.subscribe(cb);
  },

  getSnapshot(): HistoryState {
    return store.get();
  },
};
