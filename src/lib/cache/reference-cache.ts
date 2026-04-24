/**
 * =============================================================================
 * ENTERPRISE: Client-side Reference Data Cache (SWR-style)
 * =============================================================================
 *
 * Module-level cache for slowly-changing reference data (projects, companies,
 * buildings list, ...). Implements the **stale-while-revalidate** pattern:
 *
 *   1. First request: network fetch, populate cache, resolve callers.
 *   2. Subsequent requests within staleTime: instant hit from cache.
 *   3. Request beyond staleTime: return stale data immediately AND refetch
 *      in the background — the UI never shows a spinner for known data.
 *
 * Key properties:
 *   • Request deduplication — concurrent calls share one in-flight promise.
 *   • Cross-component sync — subscribers are notified when the cache updates.
 *   • Explicit invalidation — write-paths call `invalidate(key)` after
 *     create/update/delete so listeners refetch with fresh data.
 *   • Zero dependencies — no SWR / react-query required.
 *
 * @module lib/cache/reference-cache
 */

interface CacheEntry<T> {
  /** Last successfully fetched data, or `undefined` before first success. */
  data: T | undefined;
  /** Last error, cleared on successful refetch. */
  error: Error | undefined;
  /** Wall-clock timestamp of the most recent successful fetch. */
  timestamp: number;
  /** In-flight fetch promise (request deduplication); cleared on settle. */
  promise?: Promise<T>;
}

type Listener = () => void;

const cache = new Map<string, CacheEntry<unknown>>();
const subscribers = new Map<string, Set<Listener>>();

function notify(key: string): void {
  const set = subscribers.get(key);
  if (!set) return;
  for (const cb of set) cb();
}

/** Returns the current cache entry for a key (or `undefined` if not cached). */
export function getCached<T>(key: string): CacheEntry<T> | undefined {
  return cache.get(key) as CacheEntry<T> | undefined;
}

/** Subscribe to updates for a key. Returns an unsubscribe function. */
export function subscribe(key: string, listener: Listener): () => void {
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) subscribers.delete(key);
  };
}

/**
 * Triggers a fetch for a key, sharing an in-flight promise with concurrent
 * callers (deduplication). Updates the cache on success, stores the error
 * on failure, and notifies all subscribers in both cases.
 */
export function revalidate<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing?.promise) return existing.promise;

  const base: CacheEntry<T> = existing ?? {
    data: undefined,
    error: undefined,
    timestamp: 0,
  };

  const promise = fetcher()
    .then((data) => {
      cache.set(key, {
        data,
        error: undefined,
        timestamp: Date.now(),
        promise: undefined,
      });
      notify(key);
      return data;
    })
    .catch((error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      cache.set(key, {
        data: base.data,
        error: err,
        timestamp: base.timestamp,
        promise: undefined,
      });
      notify(key);
      throw err;
    });

  cache.set(key, { ...base, promise });
  return promise;
}

/** Drops a key from the cache and wakes up all subscribers to refetch. */
export function invalidate(key: string): void {
  cache.delete(key);
  notify(key);
}

