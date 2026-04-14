'use client';

import { useCallback } from 'react';
import { useProjectAddressMutationImpactGuard } from '@/hooks/useProjectAddressMutationImpactGuard';
import type { ProjectAddressMutationRequest } from '@/lib/firestore/project-address-mutation-impact.service';

interface UseGuardedProjectAddressMutationOptions {
  readonly onBlockDismiss?: () => void;
}

export function useGuardedProjectAddressMutation(
  projectId: string,
  options: UseGuardedProjectAddressMutationOptions = {},
) {
  const { checking, previewBeforeMutate, reset, ImpactDialog } =
    useProjectAddressMutationImpactGuard(projectId, options);

  const runAddressOperation = useCallback(
    async (req: ProjectAddressMutationRequest, action: () => Promise<void>) =>
      previewBeforeMutate(req, action),
    [previewBeforeMutate],
  );

  return {
    checking,
    reset,
    ImpactDialog,
    runAddressOperation,
  };
}
