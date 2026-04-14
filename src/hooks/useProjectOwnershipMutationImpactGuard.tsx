'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';
import type { OwnershipImpactRequest } from '@/lib/firestore/project-ownership-mutation-impact.service';
import { ProjectMutationImpactDialog } from '@/components/projects/dialogs/ProjectMutationImpactDialog';

export interface UseProjectOwnershipMutationImpactGuardReturn {
  checking: boolean;
  previewBeforeMutate: (req: OwnershipImpactRequest, action: () => Promise<void>) => Promise<boolean>;
  reset: () => void;
  ImpactDialog: ReactNode;
}

interface UseProjectOwnershipMutationImpactGuardOptions {
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

export function useProjectOwnershipMutationImpactGuard(
  projectId: string,
  options: UseProjectOwnershipMutationImpactGuardOptions = {},
): UseProjectOwnershipMutationImpactGuardReturn {
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

  // Google INP pattern: close dialog first, yield to browser, then execute mutation.
  const handleConfirm = useCallback(() => {
    const action = deferredActionRef.current;
    reset();
    if (action) {
      setTimeout(() => void action(), 0);
    }
  }, [reset]);

  const previewBeforeMutate = useCallback(
    async (req: OwnershipImpactRequest, action: () => Promise<void>) => {
      setChecking(true);
      try {
        const impactPreview = await apiClient.post<ProjectMutationImpactPreview>(
          API_ROUTES.PROJECTS.OWNERSHIP_IMPACT_PREVIEW(projectId),
          req,
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
          console.error(
            `[useProjectOwnershipMutationImpactGuard] Preview failed (${error.statusCode}):`,
            error.message,
          );
        } else {
          console.error('[useProjectOwnershipMutationImpactGuard] Preview failed:', error);
        }
        deferredActionRef.current = null;
        const unavailablePreview = buildUnavailablePreview();
        previewRef.current = unavailablePreview;
        setPreview(unavailablePreview);
        setOpen(true);
        setChecking(false);
        return false;
      }
    },
    [projectId],
  );

  const ImpactDialog = useMemo(
    () => (
      <ProjectMutationImpactDialog
        open={open}
        preview={preview}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) reset();
        }}
        onConfirm={handleConfirm}
      />
    ),
    [handleConfirm, open, preview, reset],
  );

  return { checking, previewBeforeMutate, reset, ImpactDialog };
}
