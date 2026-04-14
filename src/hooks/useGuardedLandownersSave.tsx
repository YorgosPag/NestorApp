'use client';

import { useCallback } from 'react';
import { useProjectLandownersSaveImpactGuard } from '@/hooks/useProjectLandownersSaveImpactGuard';
import type { LandownersSaveImpactRequest } from '@/lib/firestore/project-landowners-save-impact.service';

export function useGuardedLandownersSave(projectId: string) {
  const { checking, previewBeforeSave, reset, ImpactDialog } =
    useProjectLandownersSaveImpactGuard(projectId);

  const runSaveOperation = useCallback(
    async (req: LandownersSaveImpactRequest, action: () => Promise<void>) =>
      previewBeforeSave(req, action),
    [previewBeforeSave],
  );

  return {
    checking,
    reset,
    ImpactDialog,
    runSaveOperation,
  };
}
