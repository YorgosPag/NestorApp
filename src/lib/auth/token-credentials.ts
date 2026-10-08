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
import { isCredentialStillValid } from '@/lib/auth/revocation-watermark';
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
 * **Η ετυμηγορία για ένα ID token — τέσσερις, ρητές** (ADR-908 §3.5).
 *
 * 🔑 Το `null` του {@link verifyIdToken} αρκεί σε όποιον απλώς **αρνείται**. Το σημείο που **εκδίδει** συνεδρία
 * (`POST /api/auth/session`) πρέπει να ξεχωρίσει τρία «όχι» που ζητούν **άλλη** αντίδραση από τον πελάτη:
 *
 * | | σημασία | τι κάνει ο εκδότης |
 * |---|---|---|
 * | `invalid` | η υπογραφή/λήξη δεν στέκει | 401 — ο πελάτης ξαναδοκιμάζει με νέο token |
 * | `revoked` | υπογεγραμμένο, αλλά η σύνδεση **ανακλήθηκε** | 401 με κωδικό — ο πελάτης **τελειώνει** τη σύνδεση |
 * | `unavailable` | **δεν μπορέσαμε να ρωτήσουμε** | 503 — ⛔ ποτέ «ανακλήθηκε» (N.12) |
 */
export type IdTokenVerdict =
  | { readonly outcome: 'valid'; readonly decoded: DecodedIdToken }
  | { readonly outcome: 'invalid' }
  | { readonly outcome: 'revoked' }
  | { readonly outcome: 'unavailable' };

/** Κρίνει το token με τον **ίδιο** κριτή ανάκλησης που ρωτούν οι αναγνώστες — και λέει **γιατί** όχι. */
export async function judgeIdToken(token: string): Promise<IdTokenVerdict> {
  if (!isFirebaseAdminAvailable()) {
    logger.info('[AUTH_CONTEXT] Cannot verify token - Admin SDK not available');
    return { outcome: 'unavailable' };
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await getAdminAuth().verifyIdToken(token);
  } catch (error) {
    logger.info('[AUTH_CONTEXT] Token verification failed:', { message: (error as Error).message });
    return { outcome: 'invalid' };
  }

  try {
    return (await unlessRevoked(decoded)) === null ? { outcome: 'revoked' } : { outcome: 'valid', decoded };
  } catch (error) {
    // Ούτε σφραγίδα στη μνήμη ούτε απάντηση από το Auth: «δεν ξέρω», όχι «ανακλήθηκε».
    logger.info('[AUTH_CONTEXT] Revocation state unavailable:', { message: (error as Error).message });
    return { outcome: 'unavailable' };
  }
}

/**
 * Verify Firebase ID token and return decoded token.
 *
 * @param token - ID token string
 * @returns DecodedIdToken or null — κάθε «όχι» της {@link judgeIdToken} είναι άρνηση εδώ (fail-closed).
 */
export async function verifyIdToken(token: string): Promise<DecodedIdToken | null> {
  const verdict = await judgeIdToken(token);
  return verdict.outcome === 'valid' ? verdict.decoded : null;
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
    const checkRevoked = options.checkRevoked === true;
    const decoded = await auth.verifySessionCookie(sessionCookie, checkRevoked);
    // `checkRevoked` ρώτησε ήδη το Auth απευθείας — δεύτερη ερώτηση θα ήταν κόστος χωρίς βεβαιότητα.
    return checkRevoked ? decoded : await unlessRevoked(decoded);
  } catch (error) {
    logger.info('[AUTH_CONTEXT] Session cookie verification failed:', { message: (error as Error).message });
    return null;
  }
}

/**
 * ADR-892 §8.1 — **υπογεγραμμένο δεν σημαίνει ισχύον.** Διαπιστευτήριο με σύνδεση **πριν** από την
 * τελευταία ανάκληση (αφαίρεση από οικείο χώρο · αναστολή λογαριασμού) απορρίπτεται — με φραγμένη
 * μνήμη αντί για `getUser` ανά αίτημα (`revocation-watermark`). Αποτυχία ερώτησης ⇒ ρίχνει ⇒ `null`
 * στον καλούντα (άρνηση), όπως το `checkRevoked`.
 */
async function unlessRevoked(decoded: DecodedIdToken): Promise<DecodedIdToken | null> {
  if (await isCredentialStillValid(decoded)) return decoded;
  logger.info('[AUTH_CONTEXT] Credential revoked after sign-in', { uid: decoded.uid });
  return null;
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
