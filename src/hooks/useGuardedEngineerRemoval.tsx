'use client';

import { useCallback } from 'react';
import { useProjectEngineerRemoveImpactGuard } from '@/hooks/useProjectEngineerRemoveImpactGuard';
import type { EngineerRemoveImpactRequest } from '@/lib/firestore/project-engineer-remove-impact.service';

export function useGuardedEngineerRemoval(projectId: string) {
  const { checking, previewBeforeRemove, reset, ImpactDialog } =
    useProjectEngineerRemoveImpactGuard(projectId);

  const runRemoveOperation = useCallback(
    async (req: EngineerRemoveImpactRequest, action: () => Promise<void>) =>
      previewBeforeRemove(req, action),
    [previewBeforeRemove],
  );

  return {
    checking,
    reset,
    ImpactDialog,
    runRemoveOperation,
  };
}
