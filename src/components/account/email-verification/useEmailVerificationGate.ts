'use client';

/**
 * @fileoverview **«Είναι επιβεβαιωμένο το email μου — ΤΩΡΑ;»** — η πύλη πριν από τον δεύτερο παράγοντα (ADR-851 Φ2).
 * @related EmailVerificationGate.tsx (η όψη) · auth/account-mail.client.ts (ο ΕΝΑΣ δρόμος αποστολής)
 * @module components/account/email-verification/useEmailVerificationGate
 *
 * 🔴 **ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ** (μετρημένο ζωντανά, 2026-10-06): η Firebase αρνείται εγγραφή δεύτερου παράγοντα σε
 * ανεπιβεβαίωτο λογαριασμό (`auth/unverified-email`). Η οθόνη το μάθαινε **αφού** πατηθεί το κουμπί, δεν έδειχνε
 * τίποτα, και **κανένα** σημείο της εφαρμογής δεν ξανάστελνε το μήνυμα — το `sendVerificationEmail` του context
 * είχε **μηδέν** καταναλωτές. Χαμένο μήνυμα εγγραφής ⇒ ο διαχειριστής δεν μπορούσε να προσκαλέσει κανέναν, ποτέ.
 *
 * 🔑 **Η αυθεντία είναι το Auth, όχι το cache**: το `emailVerified` του πελάτη είναι της στιγμής σύνδεσης. Γι' αυτό
 * ρωτάμε με `reload()` — στο άνοιγμα, και **κάθε φορά που η καρτέλα ξαναφαίνεται** (ο άνθρωπος πάτησε τον σύνδεσμο
 * σε άλλη καρτέλα και γύρισε). Η πύλη ανοίγει **μόνη της**, χωρίς αποσύνδεση/σύνδεση.
 *
 * ⚠️ **`unknown` ≠ `unverified`**: πριν απαντήσει το Auth (και στον διακομιστή, όπου δεν υπάρχει χρήστης) η πύλη
 * **δεν ισχυρίζεται τίποτα** — ο επιβεβαιωμένος δεν βλέπει ποτέ αναλαμπή «επιβεβαιώστε το email σας».
 */

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/auth';
import { isAuthError } from '@/auth/contexts/auth-context/auth-context-errors';
import { AUTH_EVENTS } from '@/config/domain-constants';
import { useTabVisibilityRefresh } from '@/hooks/useTabVisibilityRefresh';
import { auth } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('EmailVerificationGate');

/** Πόσο μένει κλειστό το «στείλτε ξανά» μετά από αποστολή — ο διακομιστής έχει το δικό του φρένο· αυτό είναι ευγένεια οθόνης. */
const RESEND_COOLDOWN_MS = 60_000;

/** Τι ξέρουμε για το γραμματοκιβώτιο — ρητά, ποτέ `boolean | undefined`. */
export type MailboxStanding = 'unknown' | 'verified' | 'unverified';

/** Η αποστολή του μηνύματος — ρητά, ποτέ `boolean` + `error`. */
export type VerificationMailState = 'idle' | 'sending' | 'sent' | 'throttled' | 'failed';

/** Ο χειροκίνητος έλεγχος («Το επιβεβαίωσα») — `still-unverified` μόνο όταν ο **άνθρωπος** ρώτησε. */
export type RecheckState = 'idle' | 'checking' | 'still-unverified';

export interface EmailVerificationGate {
  readonly standing: MailboxStanding;
  readonly email: string;
  readonly mail: VerificationMailState;
  readonly recheck: RecheckState;
  /** Στείλε ξανά το μήνυμα επιβεβαίωσης — ο υπάρχων δρόμος του context. */
  resend(): Promise<void>;
  /** «Το επιβεβαίωσα» — ρωτά το Auth και λέει την αλήθεια αν δεν ισχύει ακόμη. */
  confirm(): Promise<void>;
  /** Σιωπηλή επανερώτηση — για όποιον μόλις είδε άρνηση από τον πάροχο. */
  refresh(): Promise<MailboxStanding>;
}

/**
 * Ρώτα το Auth. Αν μόλις επιβεβαιώθηκε, το **token** πρέπει να το μάθει πριν από την επόμενη πράξη — αλλιώς ο
 * άνθρωπος βλέπει ανοιχτή πύλη και ο πάροχος κρίνει με παλιό `email_verified`.
 */
async function askAuth(): Promise<MailboxStanding> {
  const user = auth.currentUser;
  if (user === null) return 'unknown';
  if (user.emailVerified) return 'verified';
  try {
    await user.reload();
    if (!user.emailVerified) return 'unverified';
    await user.getIdToken(true);
    window.dispatchEvent(new CustomEvent(AUTH_EVENTS.REFRESH_SESSION));
    return 'verified';
  } catch (error) {
    // «Δεν μπόρεσα να ρωτήσω» ⇒ ό,τι λέει το cache· ποτέ «επιβεβαιωμένο» που δεν είδαμε.
    logger.warn('Mailbox standing could not be refreshed', { error });
    return user.emailVerified ? 'verified' : 'unverified';
  }
}

export function useEmailVerificationGate(): EmailVerificationGate {
  const { user, sendVerificationEmail } = useAuth();
  const [standing, setStanding] = useState<MailboxStanding>('unknown');
  const [mail, setMail] = useState<VerificationMailState>('idle');
  const [recheck, setRecheck] = useState<RecheckState>('idle');

  const refresh = useCallback(async (): Promise<MailboxStanding> => {
    const next = await askAuth();
    setStanding(next);
    return next;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.uid]);

  // Ο σύνδεσμος πατιέται σε ΑΛΛΗ καρτέλα· όταν ο άνθρωπος γυρίσει, η πύλη ρωτά μόνη της.
  useTabVisibilityRefresh(() => {
    if (standing === 'unverified') void refresh();
  });

  // Μετά από αποστολή (ή φρένο) το κουμπί ξανανοίγει μόνο του — ποτέ αδιέξοδο που θέλει ανανέωση σελίδας.
  useEffect(() => {
    if (mail !== 'sent' && mail !== 'throttled') return undefined;
    const timer = setTimeout(() => setMail('idle'), RESEND_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [mail]);

  const resend = useCallback(async (): Promise<void> => {
    if (mail === 'sending') return;
    setMail('sending');
    setRecheck('idle');
    try {
      await sendVerificationEmail();
      setMail('sent');
    } catch (error) {
      setMail(isAuthError(error) && error.code === 'auth/too-many-requests' ? 'throttled' : 'failed');
    }
  }, [mail, sendVerificationEmail]);

  const confirm = useCallback(async (): Promise<void> => {
    if (recheck === 'checking') return;
    setRecheck('checking');
    setRecheck((await refresh()) === 'verified' ? 'idle' : 'still-unverified');
  }, [recheck, refresh]);

  return { standing, email: user?.email ?? '', mail, recheck, resend, confirm, refresh };
}
