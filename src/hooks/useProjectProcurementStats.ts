'use client';

/**
 * useProjectProcurementStats — Fetch all 5 Project Procurement KPIs
 *
 * Calls /api/procurement/project-overview-stats?projectId=X
 * Uses useAsyncData + ADR-300 stale cache (no spinner on re-navigation).
 *
 * @module hooks/useProjectProcurementStats
 * @see ADR-330 §5.1 S3
 */

import { useAsyncData } from '@/hooks/useAsyncData';
import { createStaleCache } from '@/lib/stale-cache';
import type { ProjectProcurementStats } from '@/app/api/procurement/project-overview-stats/route';

export type { ProjectProcurementStats };

const statsCache = createStaleCache<ProjectProcurementStats>('project-procurement-stats');

async function fetchStats(projectId: string): Promise<ProjectProcurementStats> {
  const res = await fetch(
    `/api/procurement/project-overview-stats?projectId=${encodeURIComponent(projectId)}`,
  );
  if (!res.ok) throw new Error(`Failed to fetch project overview stats: ${res.status}`);
  const json = await res.json() as { success: boolean; data: ProjectProcurementStats; error?: string };
  if (!json.success) throw new Error(json.error ?? 'Unknown error');
  return json.data;
}

export function useProjectProcurementStats(projectId: string) {
  const cacheKey = projectId;
  const cached = statsCache.get(cacheKey);

  const { data, loading, error, silentRefetch } = useAsyncData<ProjectProcurementStats>({
    fetcher: async () => {
      const result = await fetchStats(projectId);
      statsCache.set(result, cacheKey);
      return result;
    },
    deps: [projectId],
    enabled: !!projectId,
    initialData: cached ?? undefined,
    silentInitialFetch: !!cached && statsCache.hasLoaded(cacheKey),
  });

  return { stats: data ?? null, isLoading: loading, error, refetch: silentRefetch };
}
