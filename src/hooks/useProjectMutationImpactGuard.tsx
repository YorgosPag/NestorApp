'use client';

import type { ReactNode } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import type { ProjectUpdatePayload } from '@/services/projects-client.service';
import {
  useProjectImpactGuard,
  type ProjectImpactGuardOptions,
} from '@/hooks/impact-guard/useProjectImpactGuard';

interface UseProjectMutationImpactGuardReturn {
  checking: boolean;
  previewBeforeMutate: (updates: ProjectUpdatePayload, action: () => Promise<void>) => Promise<boolean>;
  reset: () => void;
  ImpactDialog: ReactNode;
}

export function useProjectMutationImpactGuard(
  projectId: string,
  options: ProjectImpactGuardOptions = {},
): UseProjectMutationImpactGuardReturn {
  const { checking, previewBefore, reset, ImpactDialog } = useProjectImpactGuard<ProjectUpdatePayload>(
    'useProjectMutationImpactGuard',
    API_ROUTES.PROJECTS.IMPACT_PREVIEW(projectId),
    options,
  );

  return { checking, previewBeforeMutate: previewBefore, reset, ImpactDialog };
}
