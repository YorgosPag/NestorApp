'use client';

/**
 * @fileoverview **Η ΛΟΓΙΚΗ ΤΗΣ ΑΛΛΑΓΗΣ EMAIL** — τρεις φάσεις, καμία γνώση οθόνης (ADR-850).
 * @related components/account/email-change/AccountEmailChangeDialog.tsx (η οθόνη)
 * @module components/account/email-change/useAccountEmailChange
 *
 * ⚠️ **ΚΑΝΕΝΑ ΚΕΙΜΕΝΟ ΕΔΩ** — ίδια ραφή με το `first-contact-proof-state.ts`: το άγκιστρο
 * απαντά *«τι ισχύει»*, το συστατικό *«τι γράφεται»*.
 *
 * ⚠️ **Τα πεδία ΔΕΝ ζουν εδώ**: τα κατέχει η φόρμα (ελεγχόμενες είσοδοι) και περνούν ως
 * **ορίσματα** στην υποβολή. Εδώ ζει μόνο ό,τι επιζεί από φάση σε φάση — η νέα διεύθυνση
 * και ο `resolver` του 2ου παράγοντα.
 */

import React from 'react';
import type { MultiFactorResolver } from 'firebase/auth';

import {
  completeEmailChangeWithSecondFactor,
  requestAccountEmailChange,
  type EmailChangeIssue,
  type EmailChangeOutcome,
} from '@/auth/account-email-change';
import { auth } from '@/lib/firebase';

/** **Πού βρίσκεται η αλλαγή** — ρητά, ποτέ `isLoading` + `error` μαζί (N.7.2 #3). */
export type EmailChangePhase =
  | { readonly kind: 'credentials'; readonly issue: EmailChangeIssue | null }
  | {
      readonly kind: 'second-factor';
      readonly resolver: MultiFactorResolver;
      readonly newEmail: string;
      readonly issue: EmailChangeIssue | null;
    }
  | { readonly kind: 'sent'; readonly newEmail: string };

const INITIAL_PHASE: EmailChangePhase = { kind: 'credentials', issue: null };

/**
 * **Η επόμενη φάση** — καθαρή, εξαντλητική.
 *
 * 🔑 Με `resolver`, ένα λάθος **μένει στο βήμα του κωδικού**: ο άνθρωπος έδωσε ήδη σωστό
 * κωδικό πρόσβασης, και ένα λάθος ψηφίο δεν δικαιολογεί να τον ξαναζητήσουμε.
 */
function nextPhase(
  outcome: EmailChangeOutcome,
  newEmail: string,
  resolver: MultiFactorResolver | null,
): EmailChangePhase {
  switch (outcome.kind) {
    case 'sent':
      return { kind: 'sent', newEmail: outcome.newEmail };
    case 'second-factor':
      return { kind: 'second-factor', resolver: outcome.resolver, newEmail, issue: null };
    case 'issue':
      return resolver === null
        ? { kind: 'credentials', issue: outcome.issue }
        : { kind: 'second-factor', resolver, newEmail, issue: outcome.issue };
  }
}

export interface AccountEmailChangeFlow {
  readonly phase: EmailChangePhase;
  readonly busy: boolean;
  readonly submitCredentials: (newEmail: string, password: string) => Promise<void>;
  readonly submitCode: (code: string) => Promise<void>;
  readonly reset: () => void;
}

export function useAccountEmailChange(): AccountEmailChangeFlow {
  const [phase, setPhase] = React.useState<EmailChangePhase>(INITIAL_PHASE);
  const [busy, setBusy] = React.useState(false);

  // ⚠️ **Απλές συναρτήσεις, όχι `useCallback`** — διαβάζουν το `phase` της τρέχουσας
  //    απόδοσης· ένα `useCallback([phase])` θα ξαναχτιζόταν ούτως ή άλλως.
  async function run(
    step: () => Promise<EmailChangeOutcome>,
    newEmail: string,
    resolver: MultiFactorResolver | null,
  ): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      setPhase(nextPhase(await step(), newEmail, resolver));
    } finally {
      setBusy(false);
    }
  }

  async function submitCredentials(newEmail: string, password: string): Promise<void> {
    const user = auth.currentUser;
    if (user === null) {
      setPhase({ kind: 'credentials', issue: 'failed' });
      return;
    }
    await run(() => requestAccountEmailChange(user, newEmail, password), newEmail, null);
  }

  async function submitCode(code: string): Promise<void> {
    const user = auth.currentUser;
    if (phase.kind !== 'second-factor' || user === null) return;
    const { resolver, newEmail } = phase;
    await run(
      () => completeEmailChangeWithSecondFactor(user, resolver, code, newEmail),
      newEmail,
      resolver,
    );
  }

  const reset = React.useCallback(() => {
    setPhase(INITIAL_PHASE);
    setBusy(false);
  }, []);

  return { phase, busy, submitCredentials, submitCode, reset };
}
