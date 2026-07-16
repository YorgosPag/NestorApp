/**
 * 🛡️ useLinkRemovalGuard — Pre-check hook for contact link removal
 *
 * Binding του `useDependencyGuard` (SSoT της ροής pre-check → blocked dialog).
 * Εδώ ζει μόνο ό,τι είναι ειδικό για την αποσύνδεση: το compound-dependency
 * route (contact + scope, μέσω LINK_REMOVAL_REGISTRY) και το μήνυμα
 * «η αποσύνδεση μπλοκαρίστηκε».
 *
 * Η επιφάνειά του είναι σκόπιμα ΣΤΕΝΟΤΕΡΗ από του `useDeletionGuard`: κανένας
 * caller δεν χρειάζεται `checkResult`/`resetCheck` — το `BlockedDialog` αρκεί.
 *
 * @module hooks/useLinkRemovalGuard
 * @enterprise ADR-226 — Deletion Guard
 */

'use client';

import type { ReactNode } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { useDependencyGuard } from '@/hooks/guards/useDependencyGuard';

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
  const { checking, blocked, runCheck, BlockedDialog } = useDependencyGuard({
    checkRoute: (linkId) => API_ROUTES.LINK_REMOVAL_GUARD.CHECK(linkId),
    unavailableMessage:
      'Η αποσύνδεση μπλοκαρίστηκε γιατί ο έλεγχος εξαρτήσεων δεν ολοκληρώθηκε αξιόπιστα. Δοκιμάστε ξανά ή επικοινωνήστε με διαχειριστή.',
    logName: 'useLinkRemovalGuard',
  });

  return { checking, blocked, checkBeforeRemove: runCheck, BlockedDialog };
}
