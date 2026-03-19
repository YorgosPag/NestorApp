/**
 * 🛡️ useDeletionGuard — Pre-check hook for entity deletion
 *
 * Encapsulates the full deletion guard flow:
 * 1. Call GET /api/deletion-guard/{entityType}/{entityId}
 * 2. If blocked → render DeletionBlockedDialog
 * 3. If allowed → return true so caller can show confirm dialog
 *
 * @module hooks/useDeletionGuard
 * @enterprise ADR-226 — Deletion Guard (Phase 3)
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { DeletionBlockedDialog } from '@/components/shared/DeletionBlockedDialog';
import type { EntityType, DependencyCheckResult } from '@/config/deletion-registry';

// ============================================================================
// TYPES
// ============================================================================

interface UseDeletionGuardReturn {
  /** True while the pre-check API call is in flight */
  checking: boolean;
  /** True if the last check found blocking dependencies */
  blocked: boolean;
  /** The raw check result (null until a check completes) */
  checkResult: DependencyCheckResult | null;
  /** Run pre-check. Returns true if deletion is allowed. */
  checkBeforeDelete: (entityId: string) => Promise<boolean>;
  /** Reset state (closes blocked dialog) */
  resetCheck: () => void;
  /** Ready-to-render blocked dialog — place in JSX */
  BlockedDialog: React.ReactNode;
}

// ============================================================================
// HOOK
// ============================================================================

export function useDeletionGuard(entityType: EntityType): UseDeletionGuardReturn {
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [checkResult, setCheckResult] = useState<DependencyCheckResult | null>(null);

  const resetCheck = useCallback(() => {
    setBlocked(false);
    setCheckResult(null);
  }, []);

  const checkBeforeDelete = useCallback(async (entityId: string): Promise<boolean> => {
    setChecking(true);
    setBlocked(false);
    setCheckResult(null);

    try {
      const result = await apiClient.get<DependencyCheckResult>(
        API_ROUTES.DELETION_GUARD.CHECK(entityType, entityId)
      );

      setCheckResult(result);

      if (result.allowed) {
        setChecking(false);
        return true;
      }

      // Blocked — show dialog
      setBlocked(true);
      setChecking(false);
      return false;
    } catch (err) {
      // On network/server error, allow deletion to proceed
      // (the server DELETE endpoint has its own guard as fallback)
      if (ApiClientError.isApiClientError(err)) {
        console.error(`[useDeletionGuard] Pre-check failed (${err.statusCode}):`, err.message);
      } else {
        console.error('[useDeletionGuard] Pre-check failed:', err);
      }
      setChecking(false);
      return true;
    }
  }, [entityType]);

  const BlockedDialog = useMemo(() => (
    <DeletionBlockedDialog
      open={blocked}
      onOpenChange={(open) => { if (!open) resetCheck(); }}
      dependencies={checkResult?.dependencies ?? []}
      message={checkResult?.message ?? ''}
    />
  ), [blocked, checkResult, resetCheck]);

  return {
    checking,
    blocked,
    checkResult,
    checkBeforeDelete,
    resetCheck,
    BlockedDialog,
  };
}
