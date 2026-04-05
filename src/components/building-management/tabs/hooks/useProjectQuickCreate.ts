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
import { API_ROUTES } from '@/lib/api/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useProjectQuickCreate');

export interface UseProjectQuickCreateResult {
  /** null while loading OR when the last fetch failed — caller must treat
   *  null as "unknown" and MUST NOT render an empty state on null. */
  projectsCount: number | null;
  showSheet: boolean;
  setShowSheet: (open: boolean) => void;
  handleProjectCreated: (newProjectId: string) => void;
}

export function useProjectQuickCreate(
  onCreated: (newProjectId: string) => void,
): UseProjectQuickCreateResult {
  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showSheet, setShowSheet] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Direct API call so we can distinguish "0 projects" from "fetch failed".
    // getProjectsList() swallows errors and returns [] → would cause a
    // false-positive empty state on API timeout / network failure.
    apiClient
      .get<{ projects: unknown[] }>(API_ROUTES.PROJECTS.LIST)
      .then((result) => {
        if (cancelled) return;
        const list = Array.isArray(result?.projects) ? result.projects : [];
        setProjectsCount(list.length);
      })
      .catch((error) => {
        if (cancelled) return;
        // Keep projectsCount as null on failure — UI must NOT surface the
        // "no projects yet" empty state when we don't actually know.
        logger.warn('Projects count fetch failed — empty state suppressed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const handleProjectCreated = useCallback(
    (newProjectId: string) => {
      setRefreshTick((tick) => tick + 1);
      onCreated(newProjectId);
    },
    [onCreated],
  );

  return { projectsCount, showSheet, setShowSheet, handleProjectCreated };
}
