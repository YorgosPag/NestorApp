/**
 * @fileoverview **Τα κείμενα της πύλης επιβεβαίωσης email** — πλήρεις πίνακες πάνω στα κλειστά σύνολα (ADR-851 Φ2).
 * @module components/account/email-verification/email-verification-labels
 *
 * ⚠️ **Κυριολεκτικά κλειδιά, ΠΟΤΕ `${PREFIX}.x`** — οι στατικοί σαρωτές i18n (CHECK 3.8 · 3.34) βλέπουν μόνο
 * κυριολεκτικά strings (ίδιο δόγμα με το `email-change-labels.ts`).
 *
 * **Layering**: leaf — καμία εξάρτηση πέρα από τους τύπους.
 */

import type { VerificationMailState } from './useEmailVerificationGate';

export const EMAIL_GATE_KEYS = {
  title: 'twoFactor.emailGate.title',
  body: 'twoFactor.emailGate.body',
  resend: 'twoFactor.emailGate.resend',
  resending: 'twoFactor.emailGate.resending',
  recheck: 'twoFactor.emailGate.recheck',
  rechecking: 'twoFactor.emailGate.rechecking',
  stillUnverified: 'twoFactor.emailGate.stillUnverified',
} as const;

/** Η έκβαση της αποστολής που **λέγεται** στον άνθρωπο — `null` όπου δεν υπάρχει τίποτα να ειπωθεί. */
export const EMAIL_GATE_MAIL_NOTICE: Readonly<Record<VerificationMailState, { readonly tone: 'success' | 'error'; readonly key: string } | null>> = {
  idle: null,
  sending: null,
  sent: { tone: 'success', key: 'twoFactor.emailGate.sent' },
  throttled: { tone: 'error', key: 'twoFactor.emailGate.throttled' },
  failed: { tone: 'error', key: 'twoFactor.emailGate.failed' },
};
