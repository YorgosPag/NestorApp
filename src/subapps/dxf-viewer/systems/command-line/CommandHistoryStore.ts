// ADR-357 Phase 14-A — Command History Store SSoT.
// Singleton, zero React. Pattern: DynamicInputLockStore.
// Persists to localStorage (key: dxf:commandHistory), max 100 entries.
// Notify plumbing delegated to the SSoT `createExternalStore` primitive; the persisted
// `entries` slice now delegates hydrate/persist to `createPersistedValue` (composes
// `createExternalStore` + the ADR-092 `storage-utils` accessors). `navIndex` stays a
// separate, NEVER-persisted ephemeral cursor — mirrors the original, where only `push()`
// ever touched localStorage and arrow-key navigation never did.

import { createExternalStore } from '../../stores/createExternalStore';
import { createPersistedValue } from '../../stores/createPersistedValue';

const LS_KEY = 'dxf:commandHistory';
const MAX_ENTRIES = 100;

interface HistoryState {
  readonly entries: readonly string[];
  readonly navIndex: number; // -1 = not navigating; 0 = most recent
}

// Persisted slice — SAME localStorage key + serialize format as before (JSON array of
// strings). `validate` reproduces the old `Array.isArray(parsed) ? parsed : []` guard
// against a corrupt/legacy stored value.
const entriesStore = createPersistedValue<readonly string[]>(LS_KEY, [], {
  equals: Object.is,
  validate: (v) => (Array.isArray(v) ? v : []),
});

// Ephemeral slice — navigation cursor. Never persisted (matches original: only entries
// mutations reached storage; navIndex changes never did).
const navIndexStore = createExternalStore<number>(-1, { equals: Object.is });

// Memoized combined snapshot — referentially stable across calls when neither slice
// changed (required by the `useSyncExternalStore` `getSnapshot` contract).
let cachedEntries: readonly string[] | undefined;
let cachedNavIndex: number | undefined;
let cachedSnapshot: HistoryState | undefined;

function readSnapshot(): HistoryState {
  const entries = entriesStore.get();
  const navIndex = navIndexStore.get();
  if (cachedSnapshot !== undefined && cachedEntries === entries && cachedNavIndex === navIndex) {
    return cachedSnapshot;
  }
  cachedEntries = entries;
  cachedNavIndex = navIndex;
  cachedSnapshot = { entries, navIndex };
  return cachedSnapshot;
}

export const CommandHistoryStore = {
  /** Add a command to history (deduplicates consecutive identical entries). */
  push(cmd: string): void {
    const trimmed = cmd.trim().toUpperCase();
    if (!trimmed) return;

    const current = entriesStore.get();
    if (current[0] === trimmed) {
      // Same as most recent — reset nav only
      navIndexStore.set(-1);
      return;
    }

    const updated = [trimmed, ...current].slice(0, MAX_ENTRIES);
    entriesStore.set(updated); // persists via createPersistedValue
    navIndexStore.set(-1);
  },

  /**
   * Navigate backwards (older commands).
   * Returns the entry at the new position, or null if at limit.
   */
  navigateUp(): string | null {
    const entries = entriesStore.get();
    if (entries.length === 0) return null;
    const next = Math.min(navIndexStore.get() + 1, entries.length - 1);
    navIndexStore.set(next);
    return entries[next] ?? null;
  },

  /**
   * Navigate forwards (newer commands).
   * Returns the entry at the new position, or '' when past the newest.
   */
  navigateDown(): string {
    const entries = entriesStore.get();
    const navIndex = navIndexStore.get();
    if (navIndex <= 0) {
      navIndexStore.set(-1);
      return '';
    }
    const next = navIndex - 1;
    navIndexStore.set(next);
    return entries[next] ?? '';
  },

  /** Reset navigation cursor (call when user starts typing). */
  resetNavigation(): void {
    if (navIndexStore.get() === -1) return;
    navIndexStore.set(-1);
  },

  /** Get all history entries (most recent first). */
  getEntries(): readonly string[] {
    return entriesStore.get();
  },

  /** useSyncExternalStore interface */
  subscribe(cb: () => void): () => void {
    const unsubEntries = entriesStore.subscribe(cb);
    const unsubNav = navIndexStore.subscribe(cb);
    return () => {
      unsubEntries();
      unsubNav();
    };
  },

  getSnapshot(): HistoryState {
    return readSnapshot();
  },
};
