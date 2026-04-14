'use client';

import { useCallback } from 'react';
import { useProjectBrokerTerminateImpactGuard } from '@/hooks/useProjectBrokerTerminateImpactGuard';

export function useGuardedBrokerTerminate(projectId: string) {
  const { checking, previewBeforeTerminate, reset, ImpactDialog } =
    useProjectBrokerTerminateImpactGuard(projectId);

  const runTerminateOperation = useCallback(
    async (agreementId: string, action: () => Promise<void>) =>
      previewBeforeTerminate({ agreementId }, action),
    [previewBeforeTerminate],
  );

  return {
    checking,
    reset,
    ImpactDialog,
    runTerminateOperation,
  };
}
