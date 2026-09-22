'use client';

/**
 * @fileoverview **Η ΛΟΓΙΚΗ ΤΗΣ ΣΕΛΙΔΑΣ ΕΝΕΡΓΕΙΩΝ EMAIL** — τι κάνει ο κωδικός, χωρίς γνώση οθόνης.
 * @related auth/components/AuthActionContent.tsx (η οθόνη) · auth-action-modes.ts · ADR-850
 * @module auth/components/useAuthActionCode
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΩΡΙΣΤΗΚΕ — N.7.1, ΚΑΙ Η ΡΑΦΗ ΗΤΑΝ ΓΝΩΣΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `AuthActionContent.tsx` είχε φτάσει τις **455** γραμμές με τρία modes· το τέταρτο
 * (`verifyAndChangeEmail`) και η ανάκτηση με νέο κωδικό θα το περνούσαν το όριο. Ίδια ραφή
 * με το `first-contact-proof-state.ts`: *«τι ισχύει»* εδώ, *«τι βλέπει»* εκεί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΝΑΣ ΚΩΔΙΚΟΣ, ΜΙΑ ΚΛΗΣΗ — ΑΚΟΜΗ ΚΑΙ ΣΤΟ STRICT MODE
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κωδικός ενέργειας είναι **μιας χρήσης**. Το `useEffect` τρέχει **δύο φορές** στο
 * StrictMode της ανάπτυξης: η δεύτερη `applyActionCode` θα έβρισκε κωδικό **ήδη
 * εξαργυρωμένο** και η οθόνη θα έλεγε «ο σύνδεσμος έληξε» για κάτι που **πέτυχε**. Το
 * {@link useAuthActionCode} κρατά **ποιον κωδικό ξεκίνησε** και δεν τον ξαναστέλνει.
 */

import React from 'react';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';

import { useAuthOptional } from '@/auth/contexts/AuthContext';
import { sameChannelEmail } from '@/lib/contact/channel-email';
import { auth } from '@/lib/firebase';
import { firebaseErrorCode, mapFirebaseError, type ActionErrorTranslator } from './auth-action-errors';
import type { AuthActionMode } from './auth-action-modes';

export type ActionStatus = 'loading' | 'success' | 'error' | 'input';

export interface ActionState {
  readonly status: ActionStatus;
  readonly mode: AuthActionMode | null;
  /**
   * Η διεύθυνση που **ισχύει πλέον** — του λογαριασμού στο reset, η **νέα** στην αλλαγή,
   * η **αποκατεστημένη** στην ανάκτηση. `null` όταν δεν μάθαμε καμία.
   */
  readonly email: string | null;
  readonly errorMessage: string | null;
  /**
   * Η ενέργεια **είχε ήδη γίνει** (σήμερα μόνο: email ήδη επιβεβαιωμένο) — επιτυχία, με δική της φράση.
   * Απών ⇒ η επιτυχία είναι αυτής της επίσκεψης.
   */
  readonly alreadyDone?: true;
}

/** Ο νέος κωδικός **μετά από ανάκτηση** — ρητά, ποτέ `boolean` + `error`. */
export type RecoveryResetState = 'idle' | 'sending' | 'sent' | 'failed';

/** Ίδιο όριο με την αρχική φόρμα — κανόνας της Firebase. */
const MIN_PASSWORD_LENGTH = 6;

type SignOutHolder = (previousEmail: string | null) => Promise<void>;

function errorState(mode: AuthActionMode | null, message: string): ActionState {
  return { status: 'error', mode, email: null, errorMessage: message };
}

/**
 * **Αλλαγή ή επαναφορά email** — ίδια ακολουθία, ίδιο συμβόλαιο της Firebase.
 *
 * 🔑 `checkActionCode` **πριν** το `applyActionCode`: είναι ο μόνος τρόπος να μάθουμε
 * **ποια** διεύθυνση ισχύει μετά — και ποια ίσχυε πριν, ώστε να αποσυνδέσουμε **μόνο**
 * αν ο φυλλομετρητής κρατά **εκείνον** τον λογαριασμό. Πρότυπο της τεκμηρίωσης της
 * Firebase για custom handlers (`restoredEmail = info.data.email`).
 */
async function applyEmailSwitch(
  mode: 'recoverEmail' | 'verifyAndChangeEmail',
  code: string,
  signOutHolder: SignOutHolder,
): Promise<ActionState> {
  const info = await checkActionCode(auth, code);
  await applyActionCode(auth, code);
  await signOutHolder(info.data.previousEmail ?? null);
  return { status: 'success', mode, email: info.data.email ?? null, errorMessage: null };
}

/** Ο κωδικός δεν εξαργυρώνεται πια — ξοδεμένος ή ληγμένος. Η Firebase δεν λέει ποιο από τα δύο. */
const SPENT_CODE_ERRORS: ReadonlySet<string> = new Set(['auth/invalid-action-code', 'auth/expired-action-code']);

/**
 * **Επιβεβαίωση email** — και ο **ξοδεμένος** σύνδεσμος (ADR-850 · ADR-867 Β9(β) εύρημα Ε7).
 *
 * 🔑 Ο σύνδεσμος πατιέται συχνά **δύο** φορές (σαρωτής email που προφορτώνει, δεύτερη καρτέλα, «πίσω»).
 * Η δεύτερη φορά δεν είναι σφάλμα αν ο λογαριασμός **είναι** επιβεβαιωμένος — αυτό ρωτάμε, με `reload()`,
 * γιατί το `emailVerified` του cache είναι της στιγμής σύνδεσης. Πρότυπο: Google / GitHub / Slack λένε
 * «ήδη επιβεβαιωμένο», όχι «σφάλμα».
 * 🔒 **Χωρίς συνεδρία ΔΕΝ μαθαίνουμε τίποτα** — ο ξοδεμένος κωδικός δεν αποκαλύπτει λογαριασμό, και δεν
 * πρέπει: η φράση λέει τι να κάνει ο άνθρωπος (σύνδεση), χωρίς να ισχυριστεί τι ισχύει.
 */
async function applyEmailVerification(code: string, t: ActionErrorTranslator): Promise<ActionState> {
  try {
    await applyActionCode(auth, code);
    return { status: 'success', mode: 'verifyEmail', email: null, errorMessage: null };
  } catch (error: unknown) {
    if (!SPENT_CODE_ERRORS.has(firebaseErrorCode(error) ?? '')) throw error;
    const user = auth.currentUser;
    if (user === null) return errorState('verifyEmail', t('action.errors.verifyLinkSpent'));
    await user.reload().catch(() => undefined);
    if (user.emailVerified) return { status: 'success', mode: 'verifyEmail', email: null, errorMessage: null, alreadyDone: true };
    throw error;
  }
}

async function settleActionCode(
  mode: AuthActionMode | null,
  code: string | null,
  t: ActionErrorTranslator,
  signOutHolder: SignOutHolder,
): Promise<ActionState> {
  if (code === null) return errorState(null, t('action.errors.invalidCode'));
  if (mode === null) return errorState(null, t('action.errors.unknownMode'));

  try {
    switch (mode) {
      case 'verifyEmail':
        return await applyEmailVerification(code, t);
      case 'resetPassword':
        return { status: 'input', mode, email: await verifyPasswordResetCode(auth, code), errorMessage: null };
      case 'recoverEmail':
      case 'verifyAndChangeEmail':
        return await applyEmailSwitch(mode, code, signOutHolder);
    }
  } catch (error: unknown) {
    return errorState(mode, mapFirebaseError(error, t));
  }
}

export interface AuthActionCodeFlow {
  readonly state: ActionState;
  readonly submitting: boolean;
  readonly submitNewPassword: (password: string, confirmation: string) => Promise<void>;
  readonly recoveryReset: RecoveryResetState;
  readonly sendRecoveryReset: () => Promise<void>;
}

export function useAuthActionCode(
  mode: AuthActionMode | null,
  oobCode: string | null,
  t: ActionErrorTranslator,
): AuthActionCodeFlow {
  const session = useAuthOptional();
  const [state, setState] = React.useState<ActionState>({
    status: 'loading', mode, email: null, errorMessage: null,
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [recoveryReset, setRecoveryReset] = React.useState<RecoveryResetState>('idle');
  const startedFor = React.useRef<string | null | undefined>(undefined);

  // 🔴 **Αποσύνδεση ΜΟΝΟ του κατόχου του λογαριασμού που άλλαξε.** Η Firebase ανακαλεί
  //    ήδη τις συνεδρίες του· εδώ απλώς φέρνουμε τον φυλλομετρητή σε συμφωνία, ώστε να
  //    μη δείχνει το παλιό email για μία ώρα. Άλλος συνδεδεμένος λογαριασμός **μένει**.
  const signOutHolder = React.useCallback<SignOutHolder>(async (previousEmail) => {
    if (session === null || !sameChannelEmail(auth.currentUser?.email, previousEmail)) return;
    try {
      await session.signOut();
    } catch {
      // Η αλλαγή **έγινε**· μια αποτυχία τοπικής αποσύνδεσης δεν την αναιρεί.
    }
  }, [session]);

  React.useEffect(() => {
    if (startedFor.current === oobCode) return;
    startedFor.current = oobCode;
    void settleActionCode(mode, oobCode, t, signOutHolder).then(setState);
  }, [mode, oobCode, t, signOutHolder]);

  async function submitNewPassword(password: string, confirmation: string): Promise<void> {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setState((prev) => ({ ...prev, errorMessage: t('validation.passwordMinLength') }));
      return;
    }
    if (password !== confirmation) {
      setState((prev) => ({ ...prev, errorMessage: t('validation.passwordMismatch') }));
      return;
    }
    if (oobCode === null || submitting) return;

    setSubmitting(true);
    setState((prev) => ({ ...prev, errorMessage: null }));
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setState((prev) => ({ status: 'success', mode: 'resetPassword', email: prev.email, errorMessage: null }));
    } catch (error: unknown) {
      setState((prev) => ({ ...prev, errorMessage: mapFirebaseError(error, t) }));
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * **Νέος κωδικός μετά από ανάκτηση** — η σύσταση της Firebase για το `recoverEmail`.
   *
   * 🔑 Αν την αλλαγή την έκανε **άλλος**, η επαναφορά του email δεν αρκεί: μπορεί να έχει
   * ορίσει κωδικό. Ο νέος κωδικός τον κλειδώνει έξω. Μέσα από το **υπάρχον**
   * `resetPassword` του context — καμία δεύτερη κλήση `sendPasswordResetEmail`.
   */
  async function sendRecoveryReset(): Promise<void> {
    const email = state.email;
    if (recoveryReset === 'sending') return;
    if (email === null || session === null) {
      setRecoveryReset('failed');
      return;
    }
    setRecoveryReset('sending');
    try {
      await session.resetPassword(email);
      setRecoveryReset('sent');
    } catch {
      setRecoveryReset('failed');
    }
  }

  return { state, submitting, submitNewPassword, recoveryReset, sendRecoveryReset };
}
