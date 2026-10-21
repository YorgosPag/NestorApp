'use client';

/**
 * useProjectCostLedger — budget vs actual of ONE project, from its source documents.
 *
 * Calls GET /api/projects/[projectId]/cost-ledger. `useAsyncData` drops answers
 * of a superseded call, so switching projects fast never shows the previous
 * project's bars; ADR-300 stale cache ⇒ no spinner on re-selection.
 *
 * A budget-line write (Φ3γ) calls `invalidateProjectCostLedger`: the cached entry goes AND every mounted
 * reader of that project re-reads silently — tab and card never disagree about the budget.
 *
 * @module hooks/useProjectCostLedger
 * @see ADR-917 §4 Δ3 (β)
 */

import { useEffect } from 'react';
import { useAsyncData } from '@/hooks/useAsyncData';
import { createStaleCache } from '@/lib/stale-cache';
import { createExternalStore } from '@/lib/state/createExternalStore';
import { API_ROUTES } from '@/config/domain-constants';
import type { ProjectCostLedgerView } from '@/services/project-cost/cost-ledger-view';

const ledgerCache = createStaleCache<ProjectCostLedgerView>('project-cost-ledger');

/** Which project's ledger went stale last — a version signal, so the same project twice still notifies. */
interface LedgerStaleSignal {
  readonly projectId: string | null;
  readonly version: number;
}

const ledgerStale = createExternalStore<LedgerStaleSignal>({ projectId: null, version: 0 });

/** The project's ledger is stale (a source changed): drop the cache, re-read wherever it is on screen. */
export function invalidateProjectCostLedger(projectId: string): void {
  ledgerCache.invalidate(projectId);
  ledgerStale.set({ projectId, version: ledgerStale.get().version + 1 });
}

function useLedgerInvalidation(projectId: string | null, reread: () => void): void {
  useEffect(() => {
    if (!projectId) return undefined;
    return ledgerStale.subscribe(() => {
      if (ledgerStale.get().projectId === projectId) reread();
    });
  }, [projectId, reread]);
}

async function fetchLedger(projectId: string): Promise<ProjectCostLedgerView> {
  const res = await fetch(API_ROUTES.PROJECTS.COST_LEDGER(projectId));
  if (!res.ok) throw new Error(`Failed to fetch project cost ledger: ${res.status}`);
  const json = await res.json() as { success: boolean; data: ProjectCostLedgerView; error?: string };
  if (!json.success) throw new Error(json.error ?? 'Unknown error');
  return json.data;
}

export function useProjectCostLedger(projectId: string | null) {
  const cacheKey = projectId ?? '';
  const cached = projectId ? ledgerCache.get(cacheKey) : null;

  const { data, loading, error, silentRefetch } = useAsyncData<ProjectCostLedgerView>({
    fetcher: async () => {
      const result = await fetchLedger(cacheKey);
      ledgerCache.set(result, cacheKey);
      return result;
    },
    deps: [cacheKey],
    enabled: Boolean(projectId),
    initialData: cached ?? undefined,
    silentInitialFetch: Boolean(cached) && ledgerCache.hasLoaded(cacheKey),
  });

  useLedgerInvalidation(projectId, silentRefetch);

  // A ledger of another project never leaks into this one's render.
  const ledger = data && data.projectId === projectId ? data : null;
  return { ledger, isLoading: loading, error };
}
