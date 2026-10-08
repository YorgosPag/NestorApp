import 'server-only';

/**
 * @fileoverview **Το ID token από το ΣΩΜΑ του αιτήματος** — για τις διαδρομές που το δέχονται εκεί και όχι στο
 *   `Authorization` (έκδοση συνεδρίας · ολοκλήρωση εγγραφής MFA).
 * @related app/api/auth/session/route.ts · app/api/auth/mfa/enroll/complete/route.ts ·
 *   lib/auth/token-credentials.ts (ο κριτής του token — εδώ ΜΟΝΟ η ανάγνωση)
 * @module server/auth/id-token-body
 *
 * ⚠️ **Εξήχθη, δεν γράφτηκε** (N.0.2 · CHECK 3.28): οι δύο διαδρομές είχαν την ίδια ανάγνωση-και-έλεγχο αντιγραμμένη.
 * ⛔ **Δεν κρίνει τίποτα**: «είναι μη-κενό κείμενο;» δεν είναι «ισχύει;». Την ισχύ την κρίνει ο καλών με τον
 * `judgeIdToken` / `verifyIdToken`.
 */

import type { NextRequest } from 'next/server';

/** Το `idToken` του σώματος, ή `null` αν λείπει / δεν είναι μη-κενό κείμενο (ο καλών απαντά 400). */
export async function readIdTokenBody(request: NextRequest): Promise<string | null> {
  const body: unknown = await request.json();
  if (typeof body !== 'object' || body === null) return null;
  const idToken = (body as { readonly idToken?: unknown }).idToken;
  return typeof idToken === 'string' && idToken.length > 0 ? idToken : null;
}
