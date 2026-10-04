import { useEffect, useState, useCallback, useRef } from "react";
import { isDraftEntityId } from '@/lib/draft-entity-id';

/**
 * **Lazy per-project resource** — the ONE fetch lifecycle behind the project tabs
 * (`useProjectCustomers`, `useProjectStructure`).
 *
 * - Fetches once per `projectId`, only while `enabled` (lazy tabs).
 * - A draft id (`isDraftEntityId`) has nothing on the server ⇒ no request.
 * - Resets to `empty` when `projectId` changes — never shows another project's data.
 * - Unmount-safe: no state updates after unmount.
 */
export interface UseLazyProjectResourceOptions<T> {
  readonly projectId: string;
  readonly enabled: boolean;
  /** The value before the first resolve and after a `projectId` change. */
  readonly empty: T;
  readonly fetcher: (projectId: string) => Promise<T>;
  /** Message when the thrown value is not an `Error` (already translated). */
  readonly fallbackError: string;
}

export interface UseLazyProjectResourceReturn<T> {
  readonly data: T;
  readonly loading: boolean;
  readonly error: string | null;
  readonly isFetched: boolean;
  readonly refetch: () => Promise<void>;
}

export function useLazyProjectResource<T>(
  options: UseLazyProjectResourceOptions<T>
): UseLazyProjectResourceReturn<T> {
  const { projectId, enabled, empty, fallbackError } = options;

  const [data, setData] = useState<T>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFetched, setIsFetched] = useState(false);

  const mountedRef = useRef(true);
  const hasFetchedRef = useRef(false);
  // Latest closures without re-creating `load` on every render.
  const fetcherRef = useRef(options.fetcher);
  fetcherRef.current = options.fetcher;
  const emptyRef = useRef(empty);
  emptyRef.current = empty;

  const load = useCallback(async () => {
    if (!projectId || isDraftEntityId(projectId)) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(projectId);
      if (mountedRef.current) {
        setData(result);
        setIsFetched(true);
        hasFetchedRef.current = true;
      }
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : fallbackError);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [projectId, fallbackError]);

  const refetch = useCallback(async () => {
    hasFetchedRef.current = false;
    await load();
  }, [load]);

  // Reset BEFORE the fetch effect: effects run in declaration order, and a fetch effect that runs
  // first still sees the previous project's `hasFetched` and never loads the new one.
  useEffect(() => {
    if (!projectId) return;
    hasFetchedRef.current = false;
    setData(emptyRef.current);
    setError(null);
    setIsFetched(false);
  }, [projectId]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled && !hasFetchedRef.current && projectId) load();
    return () => {
      mountedRef.current = false;
    };
  }, [enabled, projectId, load]);

  return { data, loading, error, isFetched, refetch };
}
