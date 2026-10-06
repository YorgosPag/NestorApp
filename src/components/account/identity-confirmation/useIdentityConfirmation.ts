'use client';

/**
 * @fileoverview **«Είστε όντως εσείς;»** — το βήμα επαν-πιστοποίησης πριν από ευαίσθητη πράξη λογαριασμού (ADR-851 Φ2).
 * @related IdentityConfirmationStep.tsx (η όψη) · auth/account-reauthentication.ts (η ΜΙΑ επαν-πιστοποίηση)
 * @module components/account/identity-confirmation/useIdentityConfirmation
 *
 * 🔴 **ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ** (μετρημένο ζωντανά, 2026-10-06): η Firebase αρνείται εγγραφή δεύτερου παράγοντα όταν
 * η σύνδεση δεν είναι πρόσφατη (`auth/requires-recent-login`). Η οθόνη έδειχνε «Αποτυχία εκκίνησης εγγραφής 2FA»
 * — αληθές, και **άχρηστο**: ο άνθρωπος δεν μάθαινε ούτε γιατί ούτε τι να κάνει, και ο μόνος δρόμος
 * (αποσύνδεση/σύνδεση) δεν ήταν γραμμένος πουθενά.
 *
 * 🔑 **Κατ' απαίτηση, όχι προληπτικά**: το πόσο «πρόσφατη» θέλει η Firebase τη σύνδεση **δεν είναι δημόσιο
 * συμβόλαιο** — ένα δικό μας ρολόι θα ήταν μαντεψιά. Ρωτάμε τον πάροχο με την ίδια την πράξη· μόνο αν αρνηθεί
 * ανοίγει αυτό το βήμα, και μετά την επιβεβαίωση η πράξη **συνεχίζει μόνη της**.
 *
 * ⚠️ **Κανένα κείμενο εδώ, κανένα πεδίο**: ο κωδικός ζει στη φόρμα και περνά ως όρισμα — ίδια ραφή με το
 * `useAccountEmailChange`.
 */

import { useCallback, useState } from 'react';

import { confirmIdentityWithPassword, type IdentityIssue } from '@/auth/account-reauthentication';
import { getAuthProviderInfo } from '@/auth/utils/authProviders';
import { auth } from '@/lib/firebase';

/**
 * Πώς **μπορεί** αυτός ο λογαριασμός να επιβεβαιώσει ταυτότητα. Χωρίς πάροχο κωδικού (μόνο Google · πολίτης
 * πρώτης επαφής) δεν υπάρχει τι να γραφτεί — του λέμε τον δρόμο που υπάρχει, δεν του δείχνουμε πεδίο που θα αποτύχει.
 */
export type IdentityRoute = 'password' | 'sign-in-again';

/** Η κατάσταση του βήματος — ρητά, ποτέ `open` + `error` μαζί. */
export type IdentityPrompt =
  | { readonly kind: 'closed' }
  | { readonly kind: 'open'; readonly route: IdentityRoute; readonly issue: IdentityIssue | null };

export interface IdentityConfirmationFlow {
  readonly prompt: IdentityPrompt;
  readonly busy: boolean;
  /** Ο πάροχος ζήτησε πρόσφατη σύνδεση ⇒ άνοιξε το βήμα. */
  request(): void;
  /** @returns `true` μόνο όταν η ταυτότητα **επιβεβαιώθηκε** — ο καλών συνεχίζει την πράξη που είχε αρνηθεί ο πάροχος. */
  submit(password: string): Promise<boolean>;
  cancel(): void;
}

const CLOSED: IdentityPrompt = { kind: 'closed' };

function routeOfCurrentUser(): IdentityRoute {
  return getAuthProviderInfo(auth.currentUser).isPasswordUser ? 'password' : 'sign-in-again';
}

export function useIdentityConfirmation(): IdentityConfirmationFlow {
  const [prompt, setPrompt] = useState<IdentityPrompt>(CLOSED);
  const [busy, setBusy] = useState(false);

  const request = useCallback((): void => {
    setPrompt({ kind: 'open', route: routeOfCurrentUser(), issue: null });
  }, []);

  const cancel = useCallback((): void => {
    setPrompt(CLOSED);
  }, []);

  const submit = useCallback(async (password: string): Promise<boolean> => {
    const user = auth.currentUser;
    if (user === null) {
      setPrompt({ kind: 'open', route: 'password', issue: 'failed' });
      return false;
    }
    setBusy(true);
    try {
      const outcome = await confirmIdentityWithPassword(user, password);
      if (outcome.kind === 'confirmed') {
        setPrompt(CLOSED);
        return true;
      }
      // Εδώ φτάνει όποιος γράφει τον ΠΡΩΤΟ του παράγοντα — `second-factor` δεν αναμένεται· αν έρθει, λέγεται ως αποτυχία, ποτέ ως επιτυχία.
      setPrompt({ kind: 'open', route: 'password', issue: outcome.kind === 'issue' ? outcome.issue : 'failed' });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { prompt, busy, request, submit, cancel };
}
