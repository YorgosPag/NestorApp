'use client';

/**
 * =============================================================================
 * useIkaLaborComplianceSaveImpactGuard
 * =============================================================================
 *
 * Impact guard hook for global ΕΦΚΑ labor compliance config save.
 *
 * The only guard in the family whose preview takes no request body: the endpoint
 * is a fixed route and the impact is derived server-side from current state, so
 * this binds the shared guard with an empty request.
 *
 * @enterprise ADR-307 — IKA Mutation Impact Guards
 */

import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { useProjectImpactGuard } from '@/hooks/impact-guard/useProjectImpactGuard';

const EMPTY_REQUEST = {} as const;

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

export function useIkaLaborComplianceSaveImpactGuard(): UseIkaLaborComplianceSaveImpactGuardReturn {
  const { checking, previewBefore, reset, ImpactDialog } = useProjectImpactGuard<Record<string, never>>(
    'useIkaLaborComplianceSaveImpactGuard',
    API_ROUTES.IKA.LABOR_COMPLIANCE_SAVE_PREVIEW,
  );

  const previewBeforeSave = useCallback(
    (action: () => Promise<void>) => previewBefore(EMPTY_REQUEST, action),
    [previewBefore],
  );

  return { checking, previewBeforeSave, reset, ImpactDialog };
}
