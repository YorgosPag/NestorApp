'use client';

import type { ReactNode } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import type { EngineerRemoveImpactRequest } from '@/lib/firestore/project-engineer-remove-impact.service';
import { useProjectImpactGuard } from '@/hooks/impact-guard/useProjectImpactGuard';

interface UseProjectEngineerRemoveImpactGuardReturn {
  checking: boolean;
  previewBeforeRemove: (req: EngineerRemoveImpactRequest, action: () => Promise<void>) => Promise<boolean>;
  reset: () => void;
  ImpactDialog: ReactNode;
}

export function useProjectEngineerRemoveImpactGuard(
  projectId: string,
): UseProjectEngineerRemoveImpactGuardReturn {
  const { checking, previewBefore, reset, ImpactDialog } = useProjectImpactGuard<EngineerRemoveImpactRequest>(
    'useProjectEngineerRemoveImpactGuard',
    API_ROUTES.PROJECTS.ENGINEER_IMPACT_PREVIEW(projectId),
  );

  return { checking, previewBeforeRemove: previewBefore, reset, ImpactDialog };
}
