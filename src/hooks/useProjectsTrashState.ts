'use client';

/**
 * 🗑️ useProjectsTrashState — projects binding for the trash engine.
 *
 * Projects announce through the project notification SSoT rather than the
 * generic trash toast, so the messages match the rest of the project surface.
 *
 * @module hooks/useProjectsTrashState
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-584 — Anti-Duplication
 */

import { useMemo } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { useProjectNotifications } from '@/hooks/notifications/useProjectNotifications';
import { useEntityTrashState, type EntityTrashSpec } from '@/hooks/trash/useEntityTrashState';
import type { Project } from '@/types/project';

interface UseProjectsTrashStateParams {
  forceDataRefresh: () => void;
  clearSelection?: () => void;
}

const PROJECTS_TRASH_SPEC: EntityTrashSpec<Project> = {
  entityKind: 'project',
  trashRoute: API_ROUTES.PROJECTS.TRASH,
  selectItems: response => response.projects as Project[] | undefined,
};

export function useProjectsTrashState({
  forceDataRefresh,
  clearSelection,
}: UseProjectsTrashStateParams) {
  const projectNotifications = useProjectNotifications();

  const trash = useEntityTrashState(PROJECTS_TRASH_SPEC, {
    forceDataRefresh,
    clearSelection,
    notifyRestored: () => projectNotifications.restored(),
    notifyPermanentlyDeleted: () => projectNotifications.permanentlyDeleted(),
  });

  return useMemo(
    () => ({
      showTrash: trash.showTrash,
      trashCount: trash.trashCount,
      trashedProjects: trash.items,
      loadingTrash: trash.loadingTrash,
      showPermanentDeleteDialog: trash.showPermanentDeleteDialog,
      pendingPermanentDeleteIds: trash.pendingPermanentDeleteIds,
      handleToggleTrash: trash.handleToggleTrash,
      handleTrashActionComplete: trash.handleTrashActionComplete,
      handleRestoreProjects: trash.handleRestore,
      handlePermanentDeleteProjects: trash.handlePermanentDelete,
      handleConfirmPermanentDelete: trash.handleConfirmPermanentDelete,
      handleCancelPermanentDelete: trash.handleCancelPermanentDelete,
      fetchTrashedProjects: trash.fetchTrashedItems,
    }),
    [trash],
  ) as const;
}
