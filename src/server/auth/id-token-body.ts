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

/**
 * Το `idToken` του σώματος, ή `null` αν λείπει / δεν είναι μη-κενό κείμενο / το σώμα δεν είναι JSON
 * (ο καλών απαντά 400).
 *
 * ⚠️ **Το `catch(() => null)` δεν είναι απροσεξία** (ίδια πρακτική με `lib/api/json-body`): σώμα που δεν είναι
 * JSON είναι **κακό αίτημα** (400), όχι δικό μας σφάλμα (500). Μετρημένο 2026-11-09: ένα `multipart/form-data`
 * (σώμα που αρχίζει `--`) στο `POST /api/auth/session` έριχνε `SyntaxError` → 500 → ειδοποίηση `ERROR` στην παραγωγή.
 */
export async function readIdTokenBody(request: NextRequest): Promise<string | null> {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null) return null;
  const idToken = (body as { readonly idToken?: unknown }).idToken;
  return typeof idToken === 'string' && idToken.length > 0 ? idToken : null;
}
