'use client';

import type { ReactNode } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import type { BrokerTerminateImpactRequest } from '@/lib/firestore/project-broker-terminate-impact.service';
import { useProjectImpactGuard } from '@/hooks/impact-guard/useProjectImpactGuard';

interface UseProjectBrokerTerminateImpactGuardReturn {
  checking: boolean;
  previewBeforeTerminate: (req: BrokerTerminateImpactRequest, action: () => Promise<void>) => Promise<boolean>;
  reset: () => void;
  ImpactDialog: ReactNode;
}

export function useProjectBrokerTerminateImpactGuard(
  projectId: string,
): UseProjectBrokerTerminateImpactGuardReturn {
  const { checking, previewBefore, reset, ImpactDialog } = useProjectImpactGuard<BrokerTerminateImpactRequest>(
    'useProjectBrokerTerminateImpactGuard',
    API_ROUTES.PROJECTS.BROKER_TERMINATE_PREVIEW(projectId),
  );

  return { checking, previewBeforeTerminate: previewBefore, reset, ImpactDialog };
}
