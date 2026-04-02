/**
 * 🛡️ useLinkRemovalGuard — Pre-check hook for contact link removal
 *
 * Same pattern as useDeletionGuard, but for removing contact links.
 * Checks compound dependencies (contact + scope) via LINK_REMOVAL_REGISTRY.
 *
 * @module hooks/useLinkRemovalGuard
 * @enterprise ADR-226 — Deletion Guard (Phase 2)
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { DeletionBlockedDialog } from '@/components/shared/DeletionBlockedDialog';
import type { DependencyCheckResult } from '@/config/deletion-registry';

// ============================================================================
// TYPES
// ============================================================================

interface UseLinkRemovalGuardReturn {
  /** True while the pre-check API call is in flight */
  checking: boolean;
  /** True if the last check found blocking dependencies */
  blocked: boolean;
  /** Run pre-check. Returns true if removal is allowed. */
  checkBeforeRemove: (linkId: string) => Promise<boolean>;
  /** Ready-to-render blocked dialog — place in JSX */
  BlockedDialog: ReactNode;
}

// ============================================================================
// HOOK
// ============================================================================

export function useLinkRemovalGuard(): UseLinkRemovalGuardReturn {
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [checkResult, setCheckResult] = useState<DependencyCheckResult | null>(null);

  const resetCheck = useCallback(() => {
    setBlocked(false);
    setCheckResult(null);
  }, []);

  const buildGuardUnavailableResult = useCallback((): DependencyCheckResult => ({
    allowed: false,
    dependencies: [],
    totalDependents: 0,
    message: 'Η αποσύνδεση μπλοκαρίστηκε γιατί ο έλεγχος εξαρτήσεων δεν ολοκληρώθηκε αξιόπιστα. Δοκιμάστε ξανά ή επικοινωνήστε με διαχειριστή.',
  }), []);

  const checkBeforeRemove = useCallback(async (linkId: string): Promise<boolean> => {
    setChecking(true);
    setBlocked(false);
    setCheckResult(null);

    try {
      const result = await apiClient.get<DependencyCheckResult>(
        API_ROUTES.LINK_REMOVAL_GUARD.CHECK(linkId)
      );

      setCheckResult(result);

      if (result.allowed) {
        setChecking(false);
        return true;
      }

      setBlocked(true);
      setChecking(false);
      return false;
    } catch (err) {
      if (ApiClientError.isApiClientError(err)) {
        console.error(`[useLinkRemovalGuard] Pre-check failed (${err.statusCode}):`, err.message);
      } else {
        console.error('[useLinkRemovalGuard] Pre-check failed:', err);
      }

      const fallbackResult = buildGuardUnavailableResult();
      setCheckResult(fallbackResult);
      setBlocked(true);
      setChecking(false);
      return false;
    }
  }, [buildGuardUnavailableResult]);

  const BlockedDialog = useMemo(() => (
    <DeletionBlockedDialog
      open={blocked}
      onOpenChange={(open) => { if (!open) resetCheck(); }}
      dependencies={checkResult?.dependencies ?? []}
      message={checkResult?.message ?? ''}
    />
  ), [blocked, checkResult, resetCheck]);

  return { checking, blocked, checkBeforeRemove, BlockedDialog };
}
