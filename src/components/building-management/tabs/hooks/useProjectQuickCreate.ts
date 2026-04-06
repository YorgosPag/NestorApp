'use client';

/**
 * =============================================================================
 * useProjectQuickCreate — "No projects yet" empty-state + slide-out state
 * =============================================================================
 *
 * Owns the reactive state needed to drive the shared NoProjectsEmptyState +
 * ProjectQuickCreateSheet combo when integrating the create-project flow
 * into a parent page (e.g. Building Management General tab).
 *
 * Returns:
 *   • `projectsCount` — null while loading, number after first fetch
 *   • `showSheet` / `setShowSheet` — controlled state for the slide-out
 *   • `handleProjectCreated(newProjectId)` — call from the Sheet's
 *     onProjectCreated; refreshes the count and invokes the provided
 *     `onCreated` callback so the caller can auto-select the new project.
 *
 * @module components/building-management/tabs/hooks/useProjectQuickCreate
 * @enterprise SSoT Extension — ADR-238 / ADR-284
 */

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useProjectQuickCreate');

export interface UseProjectQuickCreateResult {
  /** null while loading, number after successful fetch, or 0 after all retries exhausted. */
  projectsCount: number | null;
  /** true when the fetch failed after retries — caller can show a retry CTA. */
  fetchFailed: boolean;
  showSheet: boolean;
  setShowSheet: (open: boolean) => void;
  handleProjectCreated: (newProjectId: string) => void;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

export function useProjectQuickCreate(
  onCreated: (newProjectId: string) => void,
): UseProjectQuickCreateResult {
  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showSheet, setShowSheet] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchWithRetry(attempt: number): Promise<void> {
      try {
        const result = await apiClient.get<{ projects: unknown[] }>(API_ROUTES.PROJECTS.LIST);
        if (cancelled) return;
        const list = Array.isArray(result?.projects) ? result.projects : [];
        setProjectsCount(list.length);
        setFetchFailed(false);
      } catch (error) {
        if (cancelled) return;
        const msg = error instanceof Error ? error.message : String(error);

        if (attempt < MAX_RETRIES) {
          logger.warn(`Projects fetch attempt ${attempt + 1} failed, retrying...`, { error: msg });
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          if (!cancelled) return fetchWithRetry(attempt + 1);
        } else {
          // All retries exhausted — surface the failure so the UI can
          // still offer the "Create Project" CTA instead of showing nothing.
          logger.warn('Projects fetch failed after retries — showing fallback CTA', { error: msg });
          setFetchFailed(true);
        }
      }
    }

    fetchWithRetry(0);
    return () => { cancelled = true; };
  }, [refreshTick]);

  const handleProjectCreated = useCallback(
    (newProjectId: string) => {
      setRefreshTick((tick) => tick + 1);
      onCreated(newProjectId);
    },
    [onCreated],
  );

  return { projectsCount, fetchFailed, showSheet, setShowSheet, handleProjectCreated };
}
