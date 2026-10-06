/**
 * @fileoverview **Τα κείμενα του βήματος «είστε όντως εσείς;»** — πλήρεις πίνακες πάνω στα κλειστά σύνολα (ADR-851 Φ2).
 * @module components/account/identity-confirmation/identity-confirmation-labels
 *
 * ⚠️ **Κυριολεκτικά κλειδιά, ΠΟΤΕ `${PREFIX}.x`** — οι στατικοί σαρωτές i18n (CHECK 3.8 · 3.34) βλέπουν μόνο
 * κυριολεκτικά strings (ίδιο δόγμα με το `email-change-labels.ts`).
 *
 * **Layering**: leaf — καμία εξάρτηση πέρα από τους τύπους.
 */

import type { IdentityIssue } from '@/auth/account-reauthentication';

import type { IdentityRoute } from './useIdentityConfirmation';

export const IDENTITY_KEYS = {
  title: 'twoFactor.identity.title',
  confirm: 'twoFactor.identity.confirm',
  confirming: 'twoFactor.identity.confirming',
  /** 🔑 Δανεισμένα — **ένα** κείμενο για «τρέχων κωδικός» και για την ακύρωση. */
  password: 'account.security.currentPassword',
  cancel: 'buttons.cancel',
} as const;

/** Τι λέμε στον άνθρωπο — **ανά δρόμο**, γιατί ο καθένας έχει άλλη επόμενη κίνηση. */
export const IDENTITY_BODY_KEYS: Readonly<Record<IdentityRoute, string>> = {
  password: 'twoFactor.identity.body',
  'sign-in-again': 'twoFactor.identity.signInAgain',
};

export const IDENTITY_ISSUE_KEYS: Readonly<Record<IdentityIssue, string>> = {
  'wrong-password': 'twoFactor.identity.issues.wrong-password',
  'too-many-attempts': 'twoFactor.identity.issues.too-many-attempts',
  failed: 'twoFactor.identity.issues.failed',
};
