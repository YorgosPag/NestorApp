/**
 * @fileoverview Λογιστικές περίοδοι — η ΑΠΟΦΑΣΗ μετάβασης κατάστασης (καθαρή, χωρίς I/O)
 * @description OPEN → CLOSED → LOCKED, με CLOSED → OPEN μόνο για όποια δεν κλειδώθηκε (Entersoft / SAP OB52).
 *   Την εκτελεί ΕΝΑΣ γραφέας (`repository/accounting-repo-fiscal-periods.ts`) ΜΕΣΑ στη συναλλαγή, πάνω στη φρέσκια
 *   περίοδο: «κλείδωμα» και «ξανάνοιγμα» την ίδια στιγμή ⇒ η μία από τις δύο αρνείται, ποτέ ξεκλείδωτη κλειδωμένη.
 *
 *   🔴 Ως τις 2026-10-15 ο έλεγχος γινόταν σε ανάγνωση ΕΞΩ από τη συναλλαγή και η εγγραφή ήταν τυφλό `update`.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 6) · DECISIONS-PHASE-1b Q5/Q7
 */

import type {
  FiscalPeriod,
  FiscalPeriodAction,
  FiscalPeriodStatus,
  FiscalPeriodTransitionDecision,
  FiscalPeriodTransitionEvent,
  FiscalPeriodTransitionRequest,
} from '../types/fiscal-period';

interface TransitionRule {
  readonly from: FiscalPeriodStatus;
  readonly to: FiscalPeriodStatus;
  readonly event: FiscalPeriodTransitionEvent;
}

/** Ο ΜΟΝΟΣ πίνακας μεταβάσεων. Το LOCKED δεν έχει έξοδο (οριστικό μετά τη φορολογική δήλωση). */
const TRANSITIONS: Readonly<Record<FiscalPeriodAction, TransitionRule>> = {
  close: { from: 'OPEN', to: 'CLOSED', event: 'PERIOD_CLOSED' },
  lock: { from: 'CLOSED', to: 'LOCKED', event: 'PERIOD_LOCKED' },
  reopen: { from: 'CLOSED', to: 'OPEN', event: 'PERIOD_REOPENED' },
};

/** Τα πεδία ίχνους που γράφει κάθε μετάβαση (ποιος, πότε, γιατί). */
function auditFieldsOf(request: FiscalPeriodTransitionRequest, now: string): Partial<FiscalPeriod> {
  switch (request.action) {
    case 'close': return { closedAt: now, closedBy: request.userId };
    case 'lock': return { lockedAt: now, lockedBy: request.userId };
    case 'reopen': return { reopenedAt: now, reopenedBy: request.userId, reopenReason: request.reason };
  }
}

/** Επιτρέπεται η μετάβαση από την ΤΡΕΧΟΥΣΑ κατάσταση; Αν ναι, τι γράφεται και ποιο γεγονός ίχνους. */
export function decideFiscalPeriodTransition(
  period: FiscalPeriod,
  request: FiscalPeriodTransitionRequest,
  now: string
): FiscalPeriodTransitionDecision {
  const rule = TRANSITIONS[request.action];
  if (period.status !== rule.from) return { kind: 'refused' };
  return {
    kind: 'apply',
    to: rule.to,
    updates: { ...auditFieldsOf(request, now), status: rule.to, updatedAt: now },
    event: rule.event,
  };
}
