'use client';

/**
 * 🗑️ useProjectsTrashState
 *
 * Manages the trash view for the projects page.
 * Follows the same pattern as usePropertiesTrashState (ADR-308).
 *
 * @module hooks/useProjectsTrashState
 * @enterprise ADR-308 — Projects Soft-Delete Trash
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { TrashService } from '@/services/trash.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { Project } from '@/types/project';

const logger = createModuleLogger('useProjectsTrashState');

interface UseProjectsTrashStateParams {
  forceDataRefresh: () => void;
}

interface TrashApiResponse {
  success: boolean;
  projects: Project[];
  count: number;
}

export function useProjectsTrashState({
  forceDataRefresh,
}: UseProjectsTrashStateParams) {
  const [showTrash, setShowTrash] = useState(false);
  const [trashedProjects, setTrashedProjects] = useState<Project[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [pendingPermanentDeleteIds, setPendingPermanentDeleteIds] = useState<string[]>([]);

  const trashCount = trashedProjects.length;

  const fetchTrashedProjects = useCallback(async () => {
    setLoadingTrash(true);
    try {
      const response = await apiClient.get<TrashApiResponse>(API_ROUTES.PROJECTS.TRASH);
      setTrashedProjects(response.projects ?? []);
    } catch (error) {
      logger.error('Failed to fetch deleted projects', { error });
      setTrashedProjects([]);
    } finally {
      setLoadingTrash(false);
    }
  }, []);

  const handleToggleTrash = useCallback(async () => {
    const next = !showTrash;
    setShowTrash(next);
    if (next) {
      await fetchTrashedProjects();
    }
  }, [showTrash, fetchTrashedProjects]);

  /** Called after restore/permanent-delete to refresh both lists */
  const handleTrashActionComplete = useCallback(() => {
    forceDataRefresh();
    void fetchTrashedProjects();
  }, [forceDataRefresh, fetchTrashedProjects]);

  const handleRestoreProjects = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    logger.info('Restoring projects from trash', { ids });
    try {
      await TrashService.bulkRestore('project', ids);
      handleTrashActionComplete();
    } catch (error) {
      logger.error('Failed to restore projects', { ids, error });
    }
  }, [handleTrashActionComplete]);

  const handlePermanentDeleteProjects = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setPendingPermanentDeleteIds(ids);
    setShowPermanentDeleteDialog(true);
  }, []);

  const handleConfirmPermanentDelete = useCallback(async () => {
    if (pendingPermanentDeleteIds.length === 0) return;
    logger.info('Permanently deleting projects', { ids: pendingPermanentDeleteIds });
    try {
      await TrashService.bulkPermanentDelete('project', pendingPermanentDeleteIds);
      setShowPermanentDeleteDialog(false);
      setPendingPermanentDeleteIds([]);
      handleTrashActionComplete();
    } catch (error) {
      logger.error('Failed to permanently delete projects', { ids: pendingPermanentDeleteIds, error });
      setShowPermanentDeleteDialog(false);
      setPendingPermanentDeleteIds([]);
    }
  }, [pendingPermanentDeleteIds, handleTrashActionComplete]);

  const handleCancelPermanentDelete = useCallback(() => {
    setShowPermanentDeleteDialog(false);
    setPendingPermanentDeleteIds([]);
  }, []);

  return {
    showTrash,
    trashCount,
    trashedProjects,
    loadingTrash,
    showPermanentDeleteDialog,
    pendingPermanentDeleteIds,
    handleToggleTrash,
    handleTrashActionComplete,
    handleRestoreProjects,
    handlePermanentDeleteProjects,
    handleConfirmPermanentDelete,
    handleCancelPermanentDelete,
    fetchTrashedProjects,
  } as const;
}
