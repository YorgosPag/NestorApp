'use client';

import type { ReactNode } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import type { LandownersSaveImpactRequest } from '@/lib/firestore/project-landowners-save-impact.service';
import { useProjectImpactGuard } from '@/hooks/impact-guard/useProjectImpactGuard';

interface UseProjectLandownersSaveImpactGuardReturn {
  checking: boolean;
  previewBeforeSave: (req: LandownersSaveImpactRequest, action: () => Promise<void>) => Promise<boolean>;
  reset: () => void;
  ImpactDialog: ReactNode;
}

export function useProjectLandownersSaveImpactGuard(
  projectId: string,
): UseProjectLandownersSaveImpactGuardReturn {
  const { checking, previewBefore, reset, ImpactDialog } = useProjectImpactGuard<LandownersSaveImpactRequest>(
    'useProjectLandownersSaveImpactGuard',
    API_ROUTES.PROJECTS.LANDOWNERS_SAVE_PREVIEW(projectId),
  );

  return { checking, previewBeforeSave: previewBefore, reset, ImpactDialog };
}
