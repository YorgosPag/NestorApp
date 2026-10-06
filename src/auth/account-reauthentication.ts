/**
 * @fileoverview **«ΕΙΣΤΕ ΟΝΤΩΣ ΕΣΕΙΣ;»** — η ΜΙΑ επαν-πιστοποίηση με κωδικό για ευαίσθητες πράξεις λογαριασμού (ADR-851 Φ2 · ADR-850).
 * @related auth/account-email-change.ts (πρώτος καταναλωτής) · components/account/identity-confirmation/* (2FA)
 * @module auth/account-reauthentication
 *
 * 🔴 **ΓΙΑΤΙ ΕΙΝΑΙ ΔΙΚΟ ΤΟΥ ΑΡΧΕΙΟ** (2026-10-06): η επαν-πιστοποίηση ζούσε **μέσα** στην αλλαγή email. Η εγγραφή
 * δεύτερου παράγοντα θέλει **την ίδια** πράξη — η Firebase την αρνείται με `auth/requires-recent-login` όταν η
 * σύνδεση δεν είναι πρόσφατη — και η οθόνη έδειχνε ένα γενικό «Αποτυχία» χωρίς δρόμο. Δεύτερο αντίγραφο του
 * `reauthenticateWithCredential` + του πίνακα «λάθος κωδικός» θα ήταν δύο αλήθειες για το ίδιο ερώτημα.
 *
 * 🔑 **Ο 2ος παράγοντας ΕΠΙΣΤΡΕΦΕΤΑΙ, δεν λύνεται εδώ**: ο καλών ξέρει αν έχει οθόνη για κωδικό 6 ψηφίων.
 *
 * **Layering**: πελατική υπηρεσία — Firebase client SDK. Κανένα React, κανένα κείμενο.
 */

import { FirebaseError } from 'firebase/app';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  type MultiFactorResolver,
  type User,
} from 'firebase/auth';

import { createModuleLogger } from '@/lib/telemetry';
import { twoFactorService } from '@/services/two-factor/EnterpriseTwoFactorService';

const logger = createModuleLogger('ACCOUNT_REAUTHENTICATION');

/** Ο κωδικός με τον οποίο η Firebase λέει *«η σύνδεση δεν είναι αρκετά πρόσφατη για αυτή την πράξη»*. */
export const RECENT_SIGN_IN_REQUIRED_CODE = 'auth/requires-recent-login';

/** Γιατί **δεν** επιβεβαιώθηκε η ταυτότητα — κλειστό σύνολο, κάθε τιμή γίνεται κλειδί i18n. */
export const IDENTITY_ISSUES = ['wrong-password', 'too-many-attempts', 'failed'] as const;

export type IdentityIssue = (typeof IDENTITY_ISSUES)[number];

export type IdentityConfirmation =
  | { readonly kind: 'confirmed' }
  | { readonly kind: 'second-factor'; readonly resolver: MultiFactorResolver }
  | { readonly kind: 'issue'; readonly issue: IdentityIssue };

/**
 * Οι κωδικοί της Firebase για **λάθος κωδικό πρόσβασης** — τρεις, γιατί άλλαξαν με τα
 * χρόνια και η προστασία απαρίθμησης τους ενώνει στο `invalid-credential`.
 */
const WRONG_PASSWORD_CODES: ReadonlySet<string> = new Set([
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
]);

function issueOf(error: unknown): IdentityIssue {
  const code = error instanceof FirebaseError ? error.code : null;
  if (code !== null && WRONG_PASSWORD_CODES.has(code)) return 'wrong-password';
  if (code === 'auth/too-many-requests') return 'too-many-attempts';
  logger.error('Η επαν-πιστοποίηση δεν ολοκληρώθηκε', { code });
  return 'failed';
}

/**
 * **Επιβεβαίωσε την ταυτότητα με τον κωδικό πρόσβασης.** Επιτυχία ⇒ η Firebase θεωρεί τη σύνδεση πρόσφατη.
 *
 * ⚠️ Λογαριασμός **χωρίς** πάροχο κωδικού (μόνο Google · πολίτης πρώτης επαφής) δεν έχει τι να γράψει εδώ —
 * ο καλών το ξέρει από το `getAuthProviderInfo` και δεν δείχνει πεδίο κωδικού.
 */
export async function confirmIdentityWithPassword(user: User, password: string): Promise<IdentityConfirmation> {
  if (user.email === null) return { kind: 'issue', issue: 'failed' };

  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    return { kind: 'confirmed' };
  } catch (error: unknown) {
    const resolver = twoFactorService.getMfaResolver(error);
    if (resolver !== null) return { kind: 'second-factor', resolver };
    return { kind: 'issue', issue: issueOf(error) };
  }
}
