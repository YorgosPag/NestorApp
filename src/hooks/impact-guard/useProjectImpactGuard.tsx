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
 * 🔗 ADR-777 §8.69.13 — the state machine itself now lives in `useImpactDecision`,
 * shared with the property and contact guards. This binding only says **which**
 * endpoint and **which** dialog. `previewBefore` resolves a named `GuardResult`
 * **after** the action has finished (never a boolean returned before the decision).
 *
 * @enterprise ADR-307 — Mutation Impact Guards · ADR-584 (N.18) · ADR-664
 */

import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';
import { ProjectMutationImpactDialog } from '@/components/projects/dialogs/ProjectMutationImpactDialog';
import type { GuardResult } from '@/hooks/impact-guard/guard-result';
import { useImpactDecision, type ImpactDecisionOptions } from '@/hooks/impact-guard/useImpactDecision';

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

export type ProjectImpactGuardOptions = ImpactDecisionOptions;

export interface ProjectImpactGuard<TRequest> {
  /** True while the preview request is in-flight. */
  readonly checking: boolean;
  /**
   * Call this instead of the raw mutation. Resolves **after** the outcome is known:
   *   - allow → runs `action` ⇒ `completed` | `failed`
   *   - warn  → shows the dialog ⇒ confirm runs `action` (`completed` | `failed`), dismiss ⇒ `cancelled`
   *   - block → shows the dialog; `action` never runs ⇒ `blocked`
   */
  readonly previewBefore: (request: TRequest, action: () => Promise<void>) => Promise<GuardResult>;
  readonly reset: () => void;
  readonly ImpactDialog: ReactNode;
}

export function useProjectImpactGuard<TRequest>(
  scope: string,
  endpoint: string,
  options: ProjectImpactGuardOptions = {},
): ProjectImpactGuard<TRequest> {
  const { checking, guard, reset, dialogProps } = useImpactDecision<ProjectMutationImpactPreview>(scope, options);

  const previewBefore = useCallback(
    (request: TRequest, action: () => Promise<void>): Promise<GuardResult> =>
      guard({
        fetchPreview: () => apiClient.post<ProjectMutationImpactPreview>(endpoint, request),
        unavailablePreview: buildUnavailableProjectImpactPreview,
        action,
      }),
    [endpoint, guard],
  );

  const ImpactDialog = useMemo(() => <ProjectMutationImpactDialog {...dialogProps} />, [dialogProps]);

  return { checking, previewBefore, reset, ImpactDialog };
}
