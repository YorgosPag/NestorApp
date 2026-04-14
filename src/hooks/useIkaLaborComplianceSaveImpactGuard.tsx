'use client';

/**
 * =============================================================================
 * useIkaLaborComplianceSaveImpactGuard
 * =============================================================================
 *
 * Impact guard hook for global ΕΦΚΑ labor compliance config save.
 * Calls the preview endpoint, shows ProjectMutationImpactDialog on warn/block,
 * and defers the actual save action to after user confirmation.
 *
 * Google INP pattern: dialog closes first, browser yields, then action executes.
 *
 * @enterprise ADR-307 — IKA Mutation Impact Guards
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';
import { ProjectMutationImpactDialog } from '@/components/projects/dialogs/ProjectMutationImpactDialog';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useIkaLaborComplianceSaveImpactGuard');

export interface UseIkaLaborComplianceSaveImpactGuardReturn {
  /** True while the preview request is in-flight */
  checking: boolean;
  /**
   * Call this instead of the raw save. Fetches the preview:
   *   - allow  → executes `action` immediately
   *   - warn   → shows dialog; `action` runs on confirm
   *   - block  → shows dialog; no action possible
   * Returns true if action was executed immediately, false otherwise.
   */
  previewBeforeSave: (action: () => Promise<void>) => Promise<boolean>;
  reset: () => void;
  ImpactDialog: ReactNode;
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

export function useIkaLaborComplianceSaveImpactGuard(): UseIkaLaborComplianceSaveImpactGuardReturn {
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<ProjectMutationImpactPreview | null>(null);
  const [open, setOpen] = useState(false);
  const deferredActionRef = useRef<(() => Promise<void>) | null>(null);

  const reset = useCallback(() => {
    setOpen(false);
    setPreview(null);
    deferredActionRef.current = null;
  }, []);

  // Google INP pattern: close dialog → yield to browser → execute mutation
  const handleConfirm = useCallback(() => {
    const action = deferredActionRef.current;
    reset();
    if (action) {
      setTimeout(() => void action(), 0);
    }
  }, [reset]);

  const previewBeforeSave = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      setChecking(true);
      try {
        const impactPreview = await apiClient.post<ProjectMutationImpactPreview>(
          API_ROUTES.IKA.LABOR_COMPLIANCE_SAVE_PREVIEW,
          {},
        );

        if (impactPreview.mode === 'allow') {
          setChecking(false);
          await action();
          return true;
        }

        deferredActionRef.current = impactPreview.mode === 'warn' ? action : null;
        setPreview(impactPreview);
        setOpen(true);
        setChecking(false);
        return false;
      } catch (error) {
        if (ApiClientError.isApiClientError(error)) {
          logger.error(
            `Preview failed (${error.statusCode}): ${error.message}`,
          );
        } else {
          logger.error('Preview failed', { error });
        }
        const unavailablePreview = buildUnavailablePreview();
        deferredActionRef.current = null;
        setPreview(unavailablePreview);
        setOpen(true);
        setChecking(false);
        return false;
      }
    },
    [],
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

  return { checking, previewBeforeSave, reset, ImpactDialog };
}
