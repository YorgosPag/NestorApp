'use client';

import type { ReactNode } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import type { OwnershipImpactRequest } from '@/lib/firestore/project-ownership-mutation-impact.service';
import {
  useProjectImpactGuard,
  type ProjectImpactGuardOptions,
} from '@/hooks/impact-guard/useProjectImpactGuard';

export interface UseProjectOwnershipMutationImpactGuardReturn {
  checking: boolean;
  previewBeforeMutate: (req: OwnershipImpactRequest, action: () => Promise<void>) => Promise<boolean>;
  reset: () => void;
  ImpactDialog: ReactNode;
}

export function useProjectOwnershipMutationImpactGuard(
  projectId: string,
  options: ProjectImpactGuardOptions = {},
): UseProjectOwnershipMutationImpactGuardReturn {
  const { checking, previewBefore, reset, ImpactDialog } = useProjectImpactGuard<OwnershipImpactRequest>(
    'useProjectOwnershipMutationImpactGuard',
    API_ROUTES.PROJECTS.OWNERSHIP_IMPACT_PREVIEW(projectId),
    options,
  );

  return { checking, previewBeforeMutate: previewBefore, reset, ImpactDialog };
}
