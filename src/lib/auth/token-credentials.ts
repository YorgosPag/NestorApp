import 'server-only';

/**
 * @fileoverview **ΠΩΣ ΠΑΙΡΝΩ ΑΠΟΚΩΔΙΚΟΠΟΙΗΜΕΝΟ TOKEN** — τα διαπιστευτήρια του συνόρου API.
 * @related ADR-817 §4.1 · ADR-077 (κεντρικό firebaseAdmin) · lib/auth/auth-context.ts
 * @module lib/auth/token-credentials
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — ΕΞΗΧΘΗ, ΔΕΝ ΓΡΑΦΤΗΚΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κώδικας είναι **ο ίδιος** που έτρεχε ήδη μέσα στο `auth-context.ts`, μαζί με τα
 * σχόλιά του. Η τομή είναι **κατά ευθύνη** (N.7.1): εδώ ζει το *«πώς βγάζω ένα
 * υπογεγραμμένο token από το αίτημα, και ισχύει;»*· εκεί το *«τι σημαίνει αυτό το
 * token — ποιος είσαι και σε ποιον χώρο ενεργείς;»*.
 *
 * ⚠️ **ΜΗΝ μεταφέρεις εδώ τον `resolveEffectiveCompanyId`.** Είναι **δηλωμένος
 * αναγνώστης καναλιού ενεργού χώρου** στο `.workspace-authority.json`
 * (`http-header@src/lib/auth/auth-context.ts`, **CHECK 3.58**) — η μετακίνησή του
 * χωρίς ενημέρωση του μητρώου μπλοκάρει, και **σωστά**: το κλειστό σύνολο υπάρχει
 * ακριβώς για να μη μετακινείται σιωπηλά ο κριτής μιας αναξιόπιστης εισόδου.
 *
 * ⚠️ **ΜΗΝ προσθέσεις εδώ τρίτο τρόπο πιστοποίησης.** Οι δύο (Bearer · cookie) είναι
 * το πλήρες σύνολο· ένας τρίτος θα ήταν τρίτη διαδρομή προς την ίδια εμπιστοσύνη.
 */

import type { DecodedIdToken } from 'firebase-admin/auth';
import type { NextRequest } from 'next/server';

import { getAdminAuth, isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';
import { SESSION_COOKIE_CONFIG } from '@/lib/auth/security-policy';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('auth-context');

const AUTHORIZATION_HEADER = 'authorization';
const BEARER_PREFIX = 'bearer';

/**
 * Extract Bearer token from Authorization header.
 *
 * @param request - NextRequest object
 * @returns Token string or null
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get(AUTHORIZATION_HEADER);
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== BEARER_PREFIX) {
    return null;
  }

  return parts[1];
}

// =============================================================================
// SESSION COOKIE EXTRACTION
// =============================================================================

/**
 * Extract Firebase session cookie (__session) from request cookies.
 *
 * @param request - NextRequest object
 * @returns Session cookie value or null
 */
export function extractSessionCookie(request: NextRequest): string | null {
  const cookie = request.cookies.get(SESSION_COOKIE_CONFIG.NAME);
  return cookie?.value ?? null;
}

// =============================================================================
// TOKEN VERIFICATION
// =============================================================================

/**
 * Verify Firebase ID token and return decoded token.
 *
 * @param token - ID token string
 * @returns DecodedIdToken or null
 */
export async function verifyIdToken(token: string): Promise<DecodedIdToken | null> {
  try {
    if (!isFirebaseAdminAvailable()) {
      logger.info('[AUTH_CONTEXT] Cannot verify token - Admin SDK not available');
      return null;
    }

    const auth = getAdminAuth();
    return await auth.verifyIdToken(token);
  } catch (error) {
    logger.info('[AUTH_CONTEXT] Token verification failed:', { message: (error as Error).message });
    return null;
  }
}

/**
 * Verify Firebase session cookie and return decoded token.
 * Same pattern as admin-guards.ts verifySessionCookieToken().
 *
 * @param sessionCookie - Session cookie string
 * @returns DecodedIdToken or null
 */
export async function verifySessionCookie(sessionCookie: string): Promise<DecodedIdToken | null> {
  try {
    if (!isFirebaseAdminAvailable()) {
      logger.info('[AUTH_CONTEXT] Cannot verify session cookie - Admin SDK not available');
      return null;
    }

    const auth = getAdminAuth();
    return await auth.verifySessionCookie(sessionCookie, false);
  } catch (error) {
    logger.info('[AUTH_CONTEXT] Session cookie verification failed:', { message: (error as Error).message });
    return null;
  }
}
