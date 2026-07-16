/**
 * 🛡️ useDeletionGuard — Pre-check hook for entity deletion
 *
 * Binding του `useDependencyGuard` (SSoT της ροής pre-check → blocked dialog).
 * Εδώ ζει μόνο ό,τι είναι ειδικό για τη διαγραφή entity: το route ανά
 * `entityType` και το μήνυμα «η διαγραφή μπλοκαρίστηκε».
 *
 * @module hooks/useDeletionGuard
 * @enterprise ADR-226 — Deletion Guard (Phase 3)
 */

'use client';

import type { ReactNode } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { useDependencyGuard } from '@/hooks/guards/useDependencyGuard';
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
  BlockedDialog: ReactNode;
}

// ============================================================================
// HOOK
// ============================================================================

export function useDeletionGuard(entityType: EntityType): UseDeletionGuardReturn {
  const { checking, blocked, checkResult, runCheck, resetCheck, BlockedDialog } = useDependencyGuard({
    checkRoute: (entityId) => API_ROUTES.DELETION_GUARD.CHECK(entityType, entityId),
    unavailableMessage:
      'Η διαγραφή μπλοκαρίστηκε γιατί ο έλεγχος εξαρτήσεων δεν ολοκληρώθηκε αξιόπιστα. Δοκιμάστε ξανά ή επικοινωνήστε με διαχειριστή.',
    logName: 'useDeletionGuard',
  });

  return {
    checking,
    blocked,
    checkResult,
    checkBeforeDelete: runCheck,
    resetCheck,
    BlockedDialog,
  };
}
