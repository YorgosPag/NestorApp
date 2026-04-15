/**
 * @module stale-cache
 * @description Factory for module-level stale-while-revalidate caches.
 *
 * SSoT for the navigation-flash prevention pattern used by entity data hooks.
 * Each call to `createStaleCache` returns an isolated cache instance that
 * survives React component unmount/remount (navigation) because it lives
 * in module scope — not in component or hook state.
 *
 * ## Pattern
 * - First visit:   cache miss → `isLoading: true` → normal load → write cache
 * - Subsequent:    cache hit  → `isLoading: false` → show stale → silent revalidate
 *
 * ## Usage — REST hooks (via useAsyncData)
 * ```ts
 * const myCache = createStaleCache<MyData[]>('my-entity');
 *
 * const cachedData = myCache.get(cacheKey);
 * const { data } = useAsyncData({
 *   fetcher: async () => {
 *     const result = await fetch(...);
 *     myCache.set(result, cacheKey);
 *     return result;
 *   },
 *   initialData: cachedData,
 *   silentInitialFetch: myCache.hasLoaded(cacheKey),
 * });
 * ```
 *
 * ## Usage — onSnapshot hooks (real-time)
 * ```ts
 * const myCache = createStaleCache<MyData[]>('my-entity');
 *
 * const [data, setData] = useState<MyData[]>(myCache.get() ?? []);
 * const [isLoading, setIsLoading] = useState(!myCache.hasLoaded());
 *
 * useEffect(() => {
 *   if (!myCache.hasLoaded()) setIsLoading(true);
 *   const unsub = subscribeToMyData((fresh) => {
 *     myCache.set(fresh);
 *     setData(fresh);
 *     setIsLoading(false);
 *   });
 *   return unsub;
 * }, [deps]);
 * ```
 *
 * @see ADR-300 — Stale Cache Factory SSoT (Navigation Flash Prevention)
 */

const DEFAULT_KEY = '__default__';

/**
 * Isolated stale-while-revalidate cache for a single entity namespace.
 *
 * @typeParam T - The cached value type (array, object, primitive — anything).
 */
export interface StaleCache<T> {
  /**
   * Returns the cached value for the given key, or `null` on cache miss.
   * Omit `key` for single-entity caches (contacts, properties).
   */
  get(key?: string): T | null;

  /**
   * Writes a value to the cache and marks the key as loaded.
   * After `set()`, `hasLoaded(key)` returns `true`.
   * Omit `key` for single-entity caches.
   */
  set(value: T, key?: string): void;

  /**
   * Returns `true` if at least one successful fetch has completed for this key.
   * Remains `true` even if the cached value is an empty array or `null`-like.
   * This is the correct signal for "skip loading spinner on re-navigation".
   */
  hasLoaded(key?: string): boolean;

  /**
   * Removes the cached value and resets the loaded flag for the given key.
   * Omit `key` to invalidate all entries (e.g. on tenant change or logout).
   */
  invalidate(key?: string): void;

  /** Alias for `invalidate()` with no argument — clears all entries. */
  clear(): void;
}

/**
 * Creates an isolated module-level stale-while-revalidate cache.
 *
 * Call this at module scope (outside any function/hook/component) so the
 * cache instance is shared across all renders of the same module.
 *
 * @param namespace - Human-readable name for this cache (used in debugging).
 *
 * @example
 * // Multi-key (filter by buildingId)
 * const storagesCache = createStaleCache<Storage[]>('storages');
 *
 * @example
 * // Single-key (one list per app session)
 * const contactsCache = createStaleCache<Contact[]>('contacts');
 */
export function createStaleCache<T>(namespace: string): StaleCache<T> {
  const _store = new Map<string, T>();
  const _loaded = new Set<string>();

  const resolveKey = (key?: string): string => key ?? DEFAULT_KEY;

  const cache: StaleCache<T> = {
    get(key?: string): T | null {
      return _store.get(resolveKey(key)) ?? null;
    },

    set(value: T, key?: string): void {
      const resolved = resolveKey(key);
      _store.set(resolved, value);
      _loaded.add(resolved);
    },

    hasLoaded(key?: string): boolean {
      return _loaded.has(resolveKey(key));
    },

    invalidate(key?: string): void {
      if (key !== undefined) {
        const resolved = resolveKey(key);
        _store.delete(resolved);
        _loaded.delete(resolved);
      } else {
        _store.clear();
        _loaded.clear();
      }
    },

    clear(): void {
      cache.invalidate();
    },
  };

  // Expose namespace on the object for debugging (non-enumerable to keep logs clean)
  Object.defineProperty(cache, '__namespace', { value: namespace, enumerable: false });

  return cache;
}
