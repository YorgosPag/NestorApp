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
import { getProjectsList } from '../../building-services';

export interface UseProjectQuickCreateResult {
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
    getProjectsList().then((list) => {
      if (!cancelled) setProjectsCount(list.length);
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
