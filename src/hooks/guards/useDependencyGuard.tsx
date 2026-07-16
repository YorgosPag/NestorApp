/**
 * 🛡️ useDependencyGuard — SSoT για τα client-side dependency pre-check guards
 *
 * Η κοινή μηχανή πίσω από κάθε «ρώτα τον server αν επιτρέπεται, πριν κάνεις την
 * καταστροφική ενέργεια» ροή:
 *
 *   1. GET στο route του guard
 *   2. allowed → true (ο caller προχωρά στο δικό του confirm)
 *   3. blocked → false + render του `BlockedDialog` με τις εξαρτήσεις
 *   4. ο έλεγχος ΣΚΑΣΕ → **fail-closed**: blocked, ΟΧΙ «προχώρα»
 *
 * Ό,τι διαφέρει ανά guard ζει στο `DependencyGuardSpec` (route / μήνυμα / log
 * name) — τίποτε άλλο. Bindings: `useDeletionGuard`, `useLinkRemovalGuard`.
 *
 * @module hooks/guards/useDependencyGuard
 * @enterprise ADR-226 — Deletion Guard
 */

'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { DeletionBlockedDialog } from '@/components/shared/DeletionBlockedDialog';
import type { DependencyCheckResult } from '@/config/deletion-registry';

// ============================================================================
// TYPES
// ============================================================================

export interface DependencyGuardSpec {
  /** Φτιάχνει το route του pre-check GET για το δοσμένο id. */
  readonly checkRoute: (id: string) => string;
  /**
   * Το μήνυμα όταν ο ΙΔΙΟΣ ο έλεγχος δεν ολοκληρώθηκε (fail-closed).
   * Διαφέρει ανά guard επειδή περιγράφει την ενέργεια στον χρήστη
   * («η διαγραφή…» vs «η αποσύνδεση…») — spec, όχι drift.
   */
  readonly unavailableMessage: string;
  /** Πρόθεμα διαγνωστικών. */
  readonly logName: string;
}

export interface DependencyGuardState {
  /** True όσο το pre-check είναι σε πτήση */
  readonly checking: boolean;
  /** True αν ο τελευταίος έλεγχος βρήκε blocking εξαρτήσεις */
  readonly blocked: boolean;
  /** Το ωμό αποτέλεσμα (null μέχρι να ολοκληρωθεί έλεγχος) */
  readonly checkResult: DependencyCheckResult | null;
  /** Τρέξε το pre-check. Επιστρέφει true αν η ενέργεια επιτρέπεται. */
  readonly runCheck: (id: string) => Promise<boolean>;
  /** Καθάρισε την κατάσταση (κλείνει το blocked dialog) */
  readonly resetCheck: () => void;
  /** Έτοιμο blocked dialog — βάλ' το στο JSX */
  readonly BlockedDialog: ReactNode;
}

// ============================================================================
// HOOK
// ============================================================================

export function useDependencyGuard(spec: DependencyGuardSpec): DependencyGuardState {
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [checkResult, setCheckResult] = useState<DependencyCheckResult | null>(null);

  // Ο spec έρχεται ως inline literal από τα bindings → νέο object κάθε render.
  // Ref αντί για dependency, ώστε το `runCheck` να κρατά ΣΤΑΘΕΡΗ ταυτότητα: οι
  // consumers το βάζουν σε effect/callback deps. (Ακριβώς η παγίδα που έλυσε το
  // ADR-664 στα impact guards της ίδιας οικογένειας.)
  const specRef = useRef(spec);
  specRef.current = spec;

  const resetCheck = useCallback(() => {
    setBlocked(false);
    setCheckResult(null);
  }, []);

  const runCheck = useCallback(async (id: string): Promise<boolean> => {
    setChecking(true);
    setBlocked(false);
    setCheckResult(null);

    const { checkRoute, unavailableMessage, logName } = specRef.current;

    try {
      const result = await apiClient.get<DependencyCheckResult>(checkRoute(id));

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
      if (ApiClientError.isApiClientError(err)) {
        console.error(`[${logName}] Pre-check failed (${err.statusCode}):`, err.message);
      } else {
        console.error(`[${logName}] Pre-check failed:`, err);
      }

      // Fail-closed: αν ο έλεγχος δεν ολοκληρώθηκε αξιόπιστα, ΔΕΝ επιτρέπουμε
      // την ενέργεια — ο server-side guard είναι το τελευταίο δίχτυ, όχι το πρώτο.
      setCheckResult({
        allowed: false,
        dependencies: [],
        totalDependents: 0,
        message: unavailableMessage,
      });
      setBlocked(true);
      setChecking(false);
      return false;
    }
  }, []);

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
    runCheck,
    resetCheck,
    BlockedDialog,
  };
}
