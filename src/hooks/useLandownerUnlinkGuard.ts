/**
 * 🛡️ useLandownerUnlinkGuard — Pre-check hook for landowner removal
 *
 * Calls GET /api/projects/{projectId}/landowner-unlink-check?contactId={contactId}
 * and returns the check result variant (confirm / warning / blocked).
 *
 * Unlike useDeletionGuard, this hook does NOT render dialogs internally —
 * the parent component controls dialog state for the 3-variant scenario.
 *
 * @module hooks/useLandownerUnlinkGuard
 * @enterprise ADR-244 — Landowner Safety Guard
 */

'use client';

import { useState, useCallback } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import type { LandownerUnlinkResult } from '@/lib/firestore/landowner-unlink-guard.types';

// ============================================================================
// TYPES
// ============================================================================

interface UseLandownerUnlinkGuardReturn {
  /** True while the pre-check API call is in flight */
  checking: boolean;
  /** The raw check result (null until a check completes) */
  checkResult: LandownerUnlinkResult | null;
  /** Run pre-check. Returns the FULL result (not just variant) for immediate use. */
  checkBeforeRemove: (projectId: string, contactId: string) => Promise<LandownerUnlinkResult>;
  /** Reset state */
  resetCheck: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useLandownerUnlinkGuard(): UseLandownerUnlinkGuardReturn {
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<LandownerUnlinkResult | null>(null);

  const resetCheck = useCallback(() => {
    setCheckResult(null);
  }, []);

  /** Default result when API call fails — allow with simple confirmation */
  const FALLBACK_RESULT: LandownerUnlinkResult = {
    allowed: true, variant: 'confirm',
    blockingDeps: [], warningDeps: [],
    message: '',
  };

  const checkBeforeRemove = useCallback(async (
    projectId: string,
    contactId: string
  ): Promise<LandownerUnlinkResult> => {
    setChecking(true);
    setCheckResult(null);

    try {
      const result = await apiClient.get<LandownerUnlinkResult>(
        `/api/projects/${projectId}/landowner-unlink-check?contactId=${encodeURIComponent(contactId)}`
      );

      setCheckResult(result);
      setChecking(false);
      return result;
    } catch (err) {
      // On network/server error, default to simple confirmation
      // (better to allow removal than to silently block the user)
      if (ApiClientError.isApiClientError(err)) {
        console.error(`[useLandownerUnlinkGuard] Pre-check failed (${err.statusCode}):`, err.message);
      } else {
        console.error('[useLandownerUnlinkGuard] Pre-check failed:', err);
      }
      setChecking(false);
      return FALLBACK_RESULT;
    }
  }, []);

  return { checking, checkResult, checkBeforeRemove, resetCheck };
}
