'use client';

import { useCallback } from 'react';
import { useProjectMutationImpactGuard } from '@/hooks/useProjectMutationImpactGuard';
import type { ProjectUpdatePayload } from '@/services/projects-client.service';

interface UseGuardedProjectMutationOptions {
  readonly onBlockDismiss?: () => void;
}

export function useGuardedProjectMutation(
  projectId: string,
  options: UseGuardedProjectMutationOptions = {},
) {
  const { checking, previewBeforeMutate, reset, ImpactDialog } = useProjectMutationImpactGuard(projectId, options);

  const runExistingProjectUpdate = useCallback(
    async (updates: ProjectUpdatePayload, action: () => Promise<void>) => (
      previewBeforeMutate(updates, action)
    ),
    [previewBeforeMutate],
  );

  return {
    checking,
    reset,
    ImpactDialog,
    runExistingProjectUpdate,
  };
}
