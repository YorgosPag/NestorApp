/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΖΗΤΑ EMAIL ΛΟΓΑΡΙΑΣΜΟΥ — ΑΠΟ ΤΟΝ ΔΙΚΟ ΜΑΣ ΔΙΑΚΟΜΙΣΤΗ** (ADR-851 Φ2).
 * @module auth/account-mail.client
 *
 * Αντικαθιστά το `sendPasswordResetEmail` / `sendEmailVerification` της Firebase: εκείνα
 * έστελναν στη γλώσσα της **κονσόλας** και με σύνδεσμο της **κονσόλας** (νεκρό Vercel, ADR-851).
 *
 * 🔑 **Τα σφάλματα βγαίνουν με τον κωδικό της Firebase** (`auth/too-many-requests` ·
 * `auth/invalid-email` · `auth/network-request-failed`): ο χάρτης μηνυμάτων
 * (`auth-context-errors.ts`) τους ξέρει **ήδη** — καμία δεύτερη μετάφραση, καμία αλλαγή οθόνης.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { resolveHumanLanguage } from '@/i18n/languages';
import { ApiClientError, apiClient, PUBLIC_REQUEST } from '@/lib/api/enterprise-api-client';

/** Οι κωδικοί που ο χάρτης μηνυμάτων της σύνδεσης **ήδη** μεταφράζει. */
export type AccountMailErrorCode = 'auth/too-many-requests' | 'auth/invalid-email' | 'auth/network-request-failed';

/** Σφάλμα με `code` — το αναγνωρίζει το `isAuthError` χωρίς καμία αλλαγή. */
export class AccountMailError extends Error {
  constructor(readonly code: AccountMailErrorCode) {
    super(code);
    this.name = 'AccountMailError';
  }
}

function accountMailErrorOf(cause: unknown): AccountMailError {
  if (cause instanceof ApiClientError && cause.statusCode === 429) return new AccountMailError('auth/too-many-requests');
  if (cause instanceof ApiClientError && cause.statusCode === 400) return new AccountMailError('auth/invalid-email');
  return new AccountMailError('auth/network-request-failed');
}

/**
 * **Στείλε μου σύνδεσμο νέου κωδικού.** Δημόσια πόρτα (`skipAuth`): ο καλών μπορεί να μην
 * έχει συνεδρία — ακριβώς γι' αυτό ζητά νέο κωδικό.
 *
 * ⚠️ Η επιτυχία **δεν** σημαίνει «υπάρχει λογαριασμός» — ο διακομιστής απαντά ίδια σε όλους.
 */
export async function requestPasswordResetMail(email: string, language: string): Promise<void> {
  try {
    await apiClient.post(API_ROUTES.AUTH.PASSWORD_RESET, { email, language: resolveHumanLanguage(language) }, PUBLIC_REQUEST);
  } catch (cause: unknown) {
    throw accountMailErrorOf(cause);
  }
}

/** **Στείλε μου σύνδεσμο επιβεβαίωσης** — για τον **ίδιο** τον συνδεδεμένο (ID token). */
export async function requestEmailVerificationMail(language: string): Promise<void> {
  try {
    await apiClient.post(API_ROUTES.AUTH.EMAIL_VERIFICATION, { language: resolveHumanLanguage(language) });
  } catch (cause: unknown) {
    throw accountMailErrorOf(cause);
  }
}
