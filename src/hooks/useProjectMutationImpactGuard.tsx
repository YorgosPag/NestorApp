'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { ProjectUpdatePayload } from '@/services/projects-client.service';
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';
import { ProjectMutationImpactDialog } from '@/components/projects/dialogs/ProjectMutationImpactDialog';

interface UseProjectMutationImpactGuardReturn {
  checking: boolean;
  previewBeforeMutate: (updates: ProjectUpdatePayload, action: () => Promise<void>) => Promise<boolean>;
  reset: () => void;
  ImpactDialog: ReactNode;
}

interface UseProjectMutationImpactGuardOptions {
  onBlockDismiss?: () => void;
}

function buildUnavailablePreview(): ProjectMutationImpactPreview {
  return {
    mode: 'block',
    mutationKinds: [],
    changes: [],
    dependencies: [],
    companyLinkChange: 'none',
    messageKey: 'impactGuard.messages.unavailable',
    blockingCount: 0,
    warningCount: 0,
  };
}

export function useProjectMutationImpactGuard(
  projectId: string,
  options: UseProjectMutationImpactGuardOptions = {},
): UseProjectMutationImpactGuardReturn {
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<ProjectMutationImpactPreview | null>(null);
  const [open, setOpen] = useState(false);
  const deferredActionRef = useRef<(() => Promise<void>) | null>(null);
  const previewRef = useRef<ProjectMutationImpactPreview | null>(null);

  const reset = useCallback(() => {
    const currentPreview = previewRef.current;
    setOpen(false);
    setPreview(null);
    deferredActionRef.current = null;
    previewRef.current = null;

    if (currentPreview?.mode === 'block') {
      options.onBlockDismiss?.();
    }
  }, [options]);

  const handleConfirm = useCallback(async () => {
    const action = deferredActionRef.current;
    reset();
    if (action) {
      await action();
    }
  }, [reset]);

  const previewBeforeMutate = useCallback(async (updates: ProjectUpdatePayload, action: () => Promise<void>) => {
    setChecking(true);
    try {
      const impactPreview = await apiClient.post<ProjectMutationImpactPreview>(
        API_ROUTES.PROJECTS.IMPACT_PREVIEW(projectId),
        updates,
      );

      if (impactPreview.mode === 'allow') {
        setChecking(false);
        await action();
        return true;
      }

      deferredActionRef.current = impactPreview.mode === 'warn' ? action : null;
      previewRef.current = impactPreview;
      setPreview(impactPreview);
      setOpen(true);
      setChecking(false);
      return false;
    } catch (error) {
      if (ApiClientError.isApiClientError(error)) {
        console.error(`[useProjectMutationImpactGuard] Preview failed (${error.statusCode}):`, error.message);
      } else {
        console.error('[useProjectMutationImpactGuard] Preview failed:', error);
      }

      deferredActionRef.current = null;
      const unavailablePreview = buildUnavailablePreview();
      previewRef.current = unavailablePreview;
      setPreview(unavailablePreview);
      setOpen(true);
      setChecking(false);
      return false;
    }
  }, [projectId]);

  const ImpactDialog = useMemo(() => (
    <ProjectMutationImpactDialog
      open={open}
      preview={preview}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
      }}
      onConfirm={handleConfirm}
    />
  ), [handleConfirm, open, preview, reset]);

  return {
    checking,
    previewBeforeMutate,
    reset,
    ImpactDialog,
  };
}
