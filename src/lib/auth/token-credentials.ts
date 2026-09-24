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

  // `Bearer ` με κενή τιμή δεν είναι διαπιστευτήριο. Το δεύτερο αντίγραφο αυτής της συνάρτησης
  // (`mcp-identity.ts`, καταργήθηκε — ADR-876 §5, N.0.2) το ήξερε· το SSoT επέστρεφε `''`.
  return parts[1] === '' ? null : parts[1];
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
 * @param options.checkRevoked - Ρώτα **και** αν ανακλήθηκε (ADR-844 §13). ⚠️ Κοστίζει
 *   **ένα `getUser` ανά κλήση** (`verifyDecodedJWTNotRevokedOrDisabled` του firebase-admin)
 *   — γι' αυτό η προεπιλογή μένει `false`, όπως ήταν, για κάθε διαδρομή του hot path.
 * @returns DecodedIdToken or null
 */
export async function verifySessionCookie(
  sessionCookie: string,
  options: { readonly checkRevoked?: boolean } = {},
): Promise<DecodedIdToken | null> {
  try {
    if (!isFirebaseAdminAvailable()) {
      logger.info('[AUTH_CONTEXT] Cannot verify session cookie - Admin SDK not available');
      return null;
    }

    const auth = getAdminAuth();
    return await auth.verifySessionCookie(sessionCookie, options.checkRevoked === true);
  } catch (error) {
    logger.info('[AUTH_CONTEXT] Session cookie verification failed:', { message: (error as Error).message });
    return null;
  }
}

/**
 * **Ποιος κρατά αυτή τη συνεδρία — ΤΩΡΑ;** (ADR-844 §13) — ή `null`.
 *
 * 🔑 **Γιατί υπάρχει**: η απόδειξη γραμματοκιβωτίου ρωτά *«είναι ο αποδεικνύων ο ίδιος
 * άνθρωπος που κρατά τον κωδικό αυτού του λογαριασμού;»*. Η μόνη τίμια απάντηση είναι
 * **συνεδρία του ίδιου uid στον ίδιο φυλλομετρητή** — κωδικός **και** γραμματοκιβώτιο
 * στο ίδιο χέρι.
 *
 * 🔴 **`checkRevoked: true`, ΚΑΙ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ.** Ένα cookie που **ανακλήθηκε** δεν
 * αποδεικνύει τίποτα — αλλιώς ο επιτιθέμενος που μόλις αποσυνδέσαμε θα ξαναγινόταν
 * «κάτοχος» με το παλιό του cookie. Το επιπλέον `getUser` πληρώνεται **μόνο** εδώ, σε
 * διαδρομή που τρέχει μία φορά ανά πρόσκληση.
 *
 * ⚠️ **ΔΕΝ είναι τρίτος τρόπος πιστοποίησης** (δες κεφαλίδα): είναι το **ίδιο** cookie,
 * με αυστηρότερη ερώτηση. Δεν ζητά claims — ένας ανεπιβεβαίωτος λογαριασμός **δεν έχει**.
 */
/**
 * **Ποιος καλεί με έγκυρο ID token στο `Authorization`;** — ή `null`. (ADR-851 · ADR-660 §6)
 *
 * Για τις διαδρομές όπου ο καλών **δεν έχει** claims ακόμη (επιβεβαίωση email · κατάσταση
 * αιτήματος ένταξης) και άρα το `withAuth` θα απαντούσε 401 **ακριβώς** στον πληθυσμό τους.
 * ⚠️ **Πιστοποίηση, ΟΧΙ εξουσιοδότηση**: λέει μόνο «ποιος είναι» — τι επιτρέπεται το
 * αποφασίζει ο καλών, και μόνο για **τον ίδιο** τον χρήστη.
 */
export async function verifiedBearerUid(request: NextRequest): Promise<string | null> {
  const token = extractBearerToken(request);
  if (token === null) return null;
  return (await verifyIdToken(token))?.uid ?? null;
}

export async function sessionHolderUid(sessionCookie: string | null): Promise<string | null> {
  if (sessionCookie === null || sessionCookie === '') return null;
  const decoded = await verifySessionCookie(sessionCookie, { checkRevoked: true });
  return decoded?.uid ?? null;
}
