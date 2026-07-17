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
 *   ⚠️ Το ADR-244 υπάρχει ΔΥΟ φορές: `ADR-244-multi-buyer-co-ownership.md` (ο σχετικός εδώ) και
 *   `ADR-244-role-management-admin-console.md` (άσχετο). ΚΑΝΕΝΑ από τα δύο ΔΕΝ τεκμηριώνει την
 *   απόφαση fail-open παρακάτω — γι' αυτό υπάρχει το @variance-adr.
 *
 * @variance fail-OPEN — ΣΚΟΠΙΜΗ απόκλιση από τα αδέλφια guards. ΔΕΝ είναι bug.
 *   ΤΙ ΔΙΑΦΕΡΕΙ: αν σκάσει το ίδιο το pre-check (network/500), αυτό το hook ΕΠΙΤΡΕΠΕΙ την αφαίρεση
 *   με απλή επιβεβαίωση (βλ. FALLBACK_RESULT παρακάτω). Τα αδέλφια `useDeletionGuard` και
 *   `useLinkRemovalGuard` (bindings του SSoT `hooks/guards/useDependencyGuard.tsx`) ΜΠΛΟΚΑΡΟΥΝ —
 *   fail-closed, κλειδωμένο με tests (mutation-verified: fail-open → 4 κόκκινα).
 *   ΓΙΑΤΙ ΕΔΩ ΑΝΑΠΟΔΑ: «better to allow removal than to silently block the user».
 *   ⛔ ΜΗΝ το «ευθυγραμμίσεις» με τα αδέλφια και ΜΗΝ το κάνεις merge στο `useDependencyGuard`:
 *   θα ΑΝΤΙΣΤΡΕΨΕΙ τη σκόπιμη πολιτική ασφαλείας του. Το grep το φέρνει δίπλα τους (ίδιο
 *   `apiClient`, ίδιο `[hook] Pre-check failed` log) — είναι παγίδα, όχι ένδειξη.
 * @variance-adr ADR-226-deletion-guard.md §«Το συμβόλαιο που προστατεύει το SSoT: FAIL-CLOSED»
 *   + §«⛔ useLandownerUnlinkGuard ΔΕΝ είναι μέλος» (γρ. 597-614)
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
