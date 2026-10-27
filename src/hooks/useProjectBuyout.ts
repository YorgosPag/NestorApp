'use client';

/**
 * useProjectBuyout — the project's buyout (ADR-330 §5.1 S3.2).
 *
 * Calls GET /api/projects/[projectId]/buyout. `useAsyncData` + ADR-300 stale cache: returning to the tab shows
 * the last answer at once and re-reads silently — so an RFQ created a moment ago appears as «sourcing».
 *
 * @module hooks/useProjectBuyout
 */

import { useAsyncData } from '@/hooks/useAsyncData';
import { createStaleCache } from '@/lib/stale-cache';
import { API_ROUTES } from '@/config/domain-constants';
import type { ProjectBuyout } from '@/services/procurement/buyout/project-buyout';

const buyoutCache = createStaleCache<ProjectBuyout>('project-buyout');

async function fetchBuyout(projectId: string): Promise<ProjectBuyout> {
  const res = await fetch(API_ROUTES.PROJECTS.BUYOUT(projectId));
  if (!res.ok) throw new Error(`Failed to fetch project buyout: ${res.status}`);
  const json = await res.json() as { success: boolean; data: ProjectBuyout; error?: string };
  if (!json.success) throw new Error(json.error ?? 'Unknown error');
  return json.data;
}

export function useProjectBuyout(projectId: string) {
  const cached = buyoutCache.get(projectId);

  const { data, loading, error } = useAsyncData<ProjectBuyout>({
    fetcher: async () => {
      const result = await fetchBuyout(projectId);
      buyoutCache.set(result, projectId);
      return result;
    },
    deps: [projectId],
    enabled: !!projectId,
    initialData: cached ?? undefined,
    silentInitialFetch: !!cached && buyoutCache.hasLoaded(projectId),
  });

  return { buyout: data ?? null, isLoading: loading, error };
}
