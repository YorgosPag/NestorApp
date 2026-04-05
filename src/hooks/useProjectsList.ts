'use client';

/**
 * =============================================================================
 * ENTERPRISE: useProjectsList — cached projects list (Google pattern)
 * =============================================================================
 *
 * Typed wrapper around `useReferenceData` that serves the canonical
 * projects list from a shared, stale-while-revalidate cache.
 *
 * Benefits over per-component fetching:
 *   • Instant UI — components mount with cached data, no spinner waterfall.
 *   • Request deduplication — N components asking for projects trigger 1
 *     network call, not N.
 *   • Cross-component sync — creating a project anywhere invalidates the
 *     cache once, and every consuming component re-renders with the new list.
 *
 * @module hooks/useProjectsList
 * @see lib/cache/reference-cache
 * @see hooks/useReferenceData
 */

import { useMemo } from 'react';
import { getProjectsList, type ProjectListItem } from '@/components/building-management/building-services';
import { useReferenceData } from '@/hooks/useReferenceData';
import { invalidate } from '@/lib/cache/reference-cache';

const PROJECTS_LIST_KEY = 'ref:projects:list';
/** 2 minutes — projects rarely change, but we still revalidate eventually. */
const PROJECTS_LIST_STALE_TIME_MS = 2 * 60 * 1000;

export interface UseProjectsListResult {
  readonly projects: ProjectListItem[];
  readonly loading: boolean;
  readonly error: Error | undefined;
  readonly refetch: () => Promise<ProjectListItem[] | undefined>;
}

export function useProjectsList(options?: { enabled?: boolean }): UseProjectsListResult {
  const { data, loading, error, refetch } = useReferenceData<ProjectListItem[]>(
    PROJECTS_LIST_KEY,
    getProjectsList,
    { staleTime: PROJECTS_LIST_STALE_TIME_MS, enabled: options?.enabled ?? true },
  );

  const projects = useMemo(() => data ?? [], [data]);

  return { projects, loading, error, refetch };
}

/**
 * Invalidates the cached projects list — call this after any write that
 * adds / updates / deletes a project. Every `useProjectsList` consumer
 * will automatically refetch.
 */
export function invalidateProjectsList(): void {
  invalidate(PROJECTS_LIST_KEY);
}
