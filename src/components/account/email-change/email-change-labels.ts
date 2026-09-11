/**
 * @fileoverview **Τα κείμενα της αλλαγής email** — πλήρεις πίνακες πάνω στα κλειστά σύνολα (ADR-850).
 * @module components/account/email-change/email-change-labels
 *
 * ⚠️ **Πλήρη `Record`, ποτέ λίστες**: νέος λόγος άρνησης ή νέος δρόμος **δεν μεταγλωττίζεται**
 * χωρίς κείμενο — ίδιο ιδίωμα με το `REFUSAL_ACTION` της πρώτης επαφής.
 *
 * ⚠️ **Κυριολεκτικά κλειδιά, ΠΟΤΕ `${PREFIX}.x`**: οι στατικοί σαρωτές i18n (CHECK 3.8 ·
 * 3.34) βλέπουν μόνο κυριολεκτικά strings. Ένα κλειδί χτισμένο με template θα ήταν
 * **αόρατο** — δηλαδή ωμό κλειδί στην οθόνη που καμία πύλη δεν θα έπιανε.
 *
 * **Layering**: leaf — καμία εξάρτηση πέρα από τους τύπους.
 */

import type { EmailChangeIssue } from '@/auth/account-email-change';
import type { EmailChangeRoute } from '@/auth/utils/authProviders';

export const EMAIL_CHANGE_KEYS = {
  open: 'account.profile.emailChange.open',
  setPassword: 'account.profile.emailChange.setPassword',
  setPasswordSending: 'account.profile.emailChange.setPasswordSending',
  setPasswordSent: 'account.profile.emailChange.setPasswordSent',
  setPasswordFailed: 'account.profile.emailChange.setPasswordFailed',
  title: 'account.profile.emailChange.title',
  description: 'account.profile.emailChange.description',
  currentLabel: 'account.profile.emailChange.currentLabel',
  newLabel: 'account.profile.emailChange.newLabel',
  submit: 'account.profile.emailChange.submit',
  submitting: 'account.profile.emailChange.submitting',
  sentTitle: 'account.profile.emailChange.sentTitle',
  sentBody: 'account.profile.emailChange.sentBody',
  sentNote: 'account.profile.emailChange.sentNote',
  done: 'account.profile.emailChange.done',
  /** 🔑 Δανεισμένα — **ένα** κείμενο για «τρέχων κωδικός» και για το βήμα 2FA. */
  currentPassword: 'account.security.currentPassword',
  codeHint: 'twoFactor.enterCode',
  codeLabel: 'twoFactor.verificationCode',
  verify: 'twoFactor.verify',
  cancel: 'buttons.cancel',
} as const;

/** Η υπόδειξη κάτω από το πεδίο — **ανά δρόμο**, γιατί ο καθένας λέει άλλη αλήθεια. */
export const EMAIL_CHANGE_ROUTE_HINT_KEYS: Readonly<Record<EmailChangeRoute, string>> = {
  password: 'account.profile.emailChange.hint',
  'provider-managed': 'account.profile.emailChange.providerManaged',
  'needs-password': 'account.profile.emailChange.needsPassword',
};

export const EMAIL_CHANGE_ISSUE_KEYS: Readonly<Record<EmailChangeIssue, string>> = {
  'invalid-email': 'account.profile.emailChange.issues.invalid-email',
  'same-email': 'account.profile.emailChange.issues.same-email',
  'wrong-password': 'account.profile.emailChange.issues.wrong-password',
  'wrong-code': 'account.profile.emailChange.issues.wrong-code',
  'too-many-attempts': 'account.profile.emailChange.issues.too-many-attempts',
  failed: 'account.profile.emailChange.issues.failed',
};
