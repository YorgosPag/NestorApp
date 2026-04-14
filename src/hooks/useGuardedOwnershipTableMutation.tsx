'use client';

import { useCallback } from 'react';
import { useProjectOwnershipMutationImpactGuard } from '@/hooks/useProjectOwnershipMutationImpactGuard';
import type { OwnershipImpactRequest } from '@/lib/firestore/project-ownership-mutation-impact.service';

interface UseGuardedOwnershipTableMutationOptions {
  readonly onBlockDismiss?: () => void;
}

export function useGuardedOwnershipTableMutation(
  projectId: string,
  options: UseGuardedOwnershipTableMutationOptions = {},
) {
  const { checking, previewBeforeMutate, reset, ImpactDialog } =
    useProjectOwnershipMutationImpactGuard(projectId, options);

  const runOwnershipOperation = useCallback(
    async (req: OwnershipImpactRequest, action: () => Promise<void>) =>
      previewBeforeMutate(req, action),
    [previewBeforeMutate],
  );

  return {
    checking,
    reset,
    ImpactDialog,
    runOwnershipOperation,
  };
}
