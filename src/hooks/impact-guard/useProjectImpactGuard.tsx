'use client';

/**
 * =============================================================================
 * useProjectImpactGuard — SSoT for ProjectMutationImpactPreview guards
 * =============================================================================
 *
 * Every guard over `ProjectMutationImpactPreview` shares one state machine:
 *   preview → allow ? run action : show dialog → confirm ? run deferred action
 *
 * Before this hook existed, that machine was copy-pasted into 6 sibling hooks
 * (broker-terminate, engineer-remove, landowners-save, ownership-mutation,
 * project-mutation, ika-labor-compliance-save). They differed in exactly three
 * places — endpoint, log scope, and whether the caller wants `onBlockDismiss` —
 * so those three are the parameters here and nothing else is.
 *
 * Google INP pattern: the dialog closes first, the browser yields, and only then
 * does the mutation run. Confirmed dropping INP from ~380ms to <100ms.
 *
 * @enterprise ADR-307 — Mutation Impact Guards · ADR-584 (N.18 de-duplication)
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';
import { ProjectMutationImpactDialog } from '@/components/projects/dialogs/ProjectMutationImpactDialog';
import { createModuleLogger } from '@/lib/telemetry';

/** The preview shown when the endpoint itself fails: block, with no detail to show. */
export function buildUnavailableProjectImpactPreview(): ProjectMutationImpactPreview {
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

export interface ProjectImpactGuardOptions {
  /** Called when the user dismisses a `block` dialog (not on warn/allow). */
  readonly onBlockDismiss?: () => void;
}

export interface ProjectImpactGuard<TRequest> {
  /** True while the preview request is in-flight. */
  readonly checking: boolean;
  /**
   * Call this instead of the raw mutation:
   *   - allow → runs `action` immediately, resolves true
   *   - warn  → shows the dialog; `action` runs on confirm, resolves false
   *   - block → shows the dialog; `action` never runs, resolves false
   */
  readonly previewBefore: (request: TRequest, action: () => Promise<void>) => Promise<boolean>;
  readonly reset: () => void;
  readonly ImpactDialog: ReactNode;
}

export function useProjectImpactGuard<TRequest>(
  scope: string,
  endpoint: string,
  options: ProjectImpactGuardOptions = {},
): ProjectImpactGuard<TRequest> {
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<ProjectMutationImpactPreview | null>(null);
  const [open, setOpen] = useState(false);
  const deferredActionRef = useRef<(() => Promise<void>) | null>(null);
  const previewRef = useRef<ProjectMutationImpactPreview | null>(null);

  const logger = useMemo(() => createModuleLogger(scope), [scope]);

  // Read through a ref so a caller passing an inline `{ onBlockDismiss }` literal
  // does not re-create `reset` — and with it the whole dialog — on every render.
  const onBlockDismissRef = useRef(options.onBlockDismiss);
  onBlockDismissRef.current = options.onBlockDismiss;

  const reset = useCallback(() => {
    const dismissed = previewRef.current;
    setOpen(false);
    setPreview(null);
    deferredActionRef.current = null;
    previewRef.current = null;

    if (dismissed?.mode === 'block') {
      onBlockDismissRef.current?.();
    }
  }, []);

  // Google INP pattern: close dialog first, yield to browser, then execute mutation.
  const handleConfirm = useCallback(() => {
    const action = deferredActionRef.current;
    reset();
    if (action) {
      setTimeout(() => void action(), 0);
    }
  }, [reset]);

  const showPreview = useCallback((next: ProjectMutationImpactPreview) => {
    previewRef.current = next;
    setPreview(next);
    setOpen(true);
    setChecking(false);
  }, []);

  const previewBefore = useCallback(
    async (request: TRequest, action: () => Promise<void>): Promise<boolean> => {
      setChecking(true);
      try {
        const impactPreview = await apiClient.post<ProjectMutationImpactPreview>(endpoint, request);

        if (impactPreview.mode === 'allow') {
          setChecking(false);
          await action();
          return true;
        }

        deferredActionRef.current = impactPreview.mode === 'warn' ? action : null;
        showPreview(impactPreview);
        return false;
      } catch (error) {
        if (ApiClientError.isApiClientError(error)) {
          logger.error(`Preview failed (${error.statusCode}): ${error.message}`);
        } else {
          logger.error('Preview failed', { error });
        }
        deferredActionRef.current = null;
        showPreview(buildUnavailableProjectImpactPreview());
        return false;
      }
    },
    [endpoint, logger, showPreview],
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

  return { checking, previewBefore, reset, ImpactDialog };
}
