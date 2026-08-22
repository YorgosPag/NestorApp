/**
 * @fileoverview Request Context Builder - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Server-side request context builder that verifies Firebase ID tokens
 * and extracts RFC v6 custom claims for authorization decisions.
 *
 * Integration Notes:
 * - Uses existing Firebase Admin SDK initialization from admin-guards.ts
 * - Extends with RFC v6 requirements (companyId, globalRole, mfaEnrolled)
 * - Returns type-safe union: AuthContext | UnauthenticatedContext
 *
 * @see docs/rfc/authorization-rbac.md
 * @see src/server/admin/admin-guards.ts (existing auth patterns)
 */

import 'server-only';

import { getAdminAuth, isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { NextRequest } from 'next/server';

import type {
  AuthContext,
  UnauthenticatedContext,
  RequestContext,
  GlobalRole,
  CustomClaims,
} from './types';
import { isValidGlobalRole } from './types';
import { getDevCompanyId } from '@/config/dev-environment';
import { SESSION_COOKIE_CONFIG } from '@/lib/auth/security-policy';
// 🎫 ADR-787 Κ-2 — ο ΕΝΑΣ απαντητής του «είναι μέλος;».
// ⚠️ Το `isRoleBypass` έφυγε από εδώ επίτηδες: ο έλεγχος ρόλου έπαψε να είναι
//    *η απόφαση* και έγινε **μία από τις επτά ετυμηγορίες** μέσα στον απαντητή
//    (`platform-bypass`). Δεύτερος έλεγχος ρόλου εδώ θα ήταν δεύτερη αυθεντία.
import { decideMembership } from '@/lib/auth/workspace-membership';
import { isAllowed, orgWorkspace, type MembershipVerdict } from '@/types/workspace-membership';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('auth-context');

const SUPER_ADMIN_COMPANY_HEADER = 'x-super-admin-company-id';

/**
 * Το αποτέλεσμα του *«σε ποιον χώρο ενεργεί αυτό το αίτημα;»*.
 *
 * ⚠️ Διακριτή ένωση, **όχι** `{ companyId, overridden }` με «ασφαλή» επιστροφή
 * στον χώρο του token σε περίπτωση άρνησης. Η σιωπηλή επιστροφή θα ήταν
 * ακριβώς η βλάβη που απέρριψε το **ADR-787 Ε-5 §7**: *«δύο καρτέλες μαλώνουν
 * σιωπηλά — αλλάζεις χώρο στη μία, η άλλη αρχίζει να **γράφει αλλού** χωρίς να
 * το πει»*. Σε εργαλείο όπου ανεβαίνουν **παραδόσεις μελετών**, αυτό είναι
 * λάθος φάκελος, και η **αρχή Α4 #3** λέει πού καταλήγει.
 * ⇒ Αίτημα που ονομάζει χώρο όπου δεν επιτρέπεσαι **δεν εξυπηρετείται αλλού·
 *   απορρίπτεται**.
 */
type WorkspaceResolution =
  | {
      readonly ok: true;
      readonly companyId: string;
      readonly overridden: boolean;
      readonly verdict: MembershipVerdict;
    }
  | { readonly ok: false; readonly reason: 'workspace_forbidden' | 'workspace_unavailable' };

/**
 * 🔴 ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ Ο ΔΙΑΚΟΜΙΣΤΗΣ ΑΠΟΦΑΣΙΖΕΙ (ADR-787 Κ-2 · Ε-5)
 *
 * Μέχρι 2026-08-22 αυτή η συνάρτηση ρωτούσε **τον ρόλο** (`isRoleBypass`) και
 * μετά δεχόταν **οποιαδήποτε** τιμή κεφαλίδας — δηλαδή *«ο πελάτης ζητά → ο
 * διακομιστής **επικυρώνει τον ρόλο**»*, όχι *«→ αποφασίζει»*. Ο έλεγχος
 * *«είναι μέλος;»* **δεν υπήρχε πουθενά στην πλατφόρμα** (ADR-787 §5.1 α #3).
 *
 * Πλέον ρωτά τον **έναν** απαντητή. Είναι το **μοναδικό** σημείο επέμβασης:
 * ζει μέσα στο `buildRequestContext`, που ζει μέσα στο `withAuth`, που
 * χρησιμοποιούν **352 αρχεία διαδρομών**.
 *
 * ⚠️ Η κεφαλίδα **δεν γενικεύεται** εδώ σε όλους τους ρόλους: το **Ε-5 §5**
 * αποφάσισε ότι ο μεταφορέας γίνεται η **διεύθυνση** (Φάση 3) — μια κεφαλίδα
 * είναι αόρατη, δεν στέλνεται σε σύνδεσμο, και δεν ξεχωρίζει δύο καρτέλες.
 * Άλλαξε **ποιος απαντά** πίσω της, όχι ποιος επιτρέπεται να ρωτήσει.
 */
async function resolveEffectiveCompanyId(
  request: NextRequest,
  claims: CustomClaims,
  uid: string,
): Promise<WorkspaceResolution> {
  const requestedId = request.headers.get(SUPER_ADMIN_COMPANY_HEADER);

  // Κανένα αίτημα για άλλον χώρο ⇒ ο χώρος του υπογεγραμμένου token.
  // ⚡ **Μηδέν αναγνώσεις** — η συνήθης περίπτωση κάθε αιτήματος (Ε-5 §2).
  if (!requestedId || requestedId === claims.companyId) {
    return { ok: true, companyId: claims.companyId, overridden: false, verdict: 'home' };
  }

  const decision = await decideMembership({
    uid,
    claimCompanyId: claims.companyId,
    globalRole: claims.globalRole,
    requested: orgWorkspace(requestedId),
  });

  if (isAllowed(decision.verdict)) {
    logger.info('[AUTH_CONTEXT] Ενεργός χώρος διαφορετικός από το token — επιτράπηκε', {
      uid, original: claims.companyId, requested: requestedId, verdict: decision.verdict,
    });
    return { ok: true, companyId: requestedId, overridden: true, verdict: decision.verdict };
  }

  // ⚠️ Η αιτία κρατιέται **στα ίχνη ακέραιη** (`not-a-member` vs `suspended` vs
  //    `unknown`)· προς τα **έξω** φεύγει μόνο η αδιάκριτη μορφή της.
  logger.warn('[AUTH_CONTEXT] Ενεργός χώρος διαφορετικός από το token — απορρίφθηκε', {
    uid, original: claims.companyId, requested: requestedId, verdict: decision.verdict,
  });

  return {
    ok: false,
    reason: decision.verdict === 'unknown' ? 'workspace_unavailable' : 'workspace_forbidden',
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const AUTHORIZATION_HEADER = 'authorization';
const BEARER_PREFIX = 'bearer';

/**
 * Unauthenticated context reasons for diagnostics.
 */
type UnauthReason = UnauthenticatedContext['reason'];

// =============================================================================
// FIREBASE ADMIN ACCESS (ADR-077: Centralized via @/lib/firebaseAdmin)
// =============================================================================

// =============================================================================
// TOKEN EXTRACTION
// =============================================================================

/**
 * Extract Bearer token from Authorization header.
 *
 * @param request - NextRequest object
 * @returns Token string or null
 */
function extractBearerToken(request: NextRequest): string | null {
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
function extractSessionCookie(request: NextRequest): string | null {
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
async function verifyIdToken(token: string): Promise<DecodedIdToken | null> {
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
async function verifySessionCookie(sessionCookie: string): Promise<DecodedIdToken | null> {
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

// =============================================================================
// CLAIMS EXTRACTION
// =============================================================================

/**
 * Extract RFC v6 custom claims from decoded token.
 *
 * @param token - Decoded ID token
 * @returns CustomClaims or null if invalid
 */
function extractCustomClaims(token: DecodedIdToken): CustomClaims | null {
  // ADR-657 §3.5 — FAIL CLOSED. A token without RFC-v6 claims is not an identity
  // we can authorize. The previous env-var / 'company_admin' fallbacks silently
  // granted a default tenant + ADMIN rights to any user whose claims-provisioning
  // had failed (see scripts/audit-missing-auth-claims.js).
  const companyId = token.companyId as string | undefined;
  if (typeof companyId !== 'string' || companyId.length === 0) {
    logger.warn('[AUTH_CONTEXT] DENY — missing companyId claim', { uid: token.uid });
    return null;
  }

  const globalRoleRaw = token.globalRole as string | undefined;
  if (typeof globalRoleRaw !== 'string' || !isValidGlobalRole(globalRoleRaw)) {
    logger.warn('[AUTH_CONTEXT] DENY — missing/invalid globalRole claim', {
      uid: token.uid,
      globalRole: globalRoleRaw,
    });
    return null;
  }

  // MFA enrollment is optional
  const mfaEnrolled = token.mfaEnrolled === true;

  // Email verified is optional (from standard Firebase claims)
  const emailVerified = token.email_verified === true;

  return {
    companyId,
    globalRole: globalRoleRaw as GlobalRole,
    mfaEnrolled,
    emailVerified,
  };
}

// =============================================================================
// MAIN CONTEXT BUILDER
// =============================================================================

/**
 * Turn an already-decoded token (from a Bearer ID token OR a __session cookie)
 * into a RequestContext. Both credential paths share this — decode differs, the
 * claims→context steps are identical, so they live here once (N.18 anti-clone).
 *
 * @param decodedToken - the verified token, or null if verification failed
 * @param request - the incoming request (for super-admin company override)
 * @returns AuthContext on valid claims, else the matching UnauthenticatedContext
 */
async function contextFromDecodedToken(
  decodedToken: DecodedIdToken | null,
  request: NextRequest,
): Promise<RequestContext> {
  if (!decodedToken) {
    return createUnauthenticatedContext('invalid_token');
  }

  const claims = extractCustomClaims(decodedToken);
  if (!claims) {
    return createUnauthenticatedContext('missing_claims');
  }

  const effective = await resolveEffectiveCompanyId(request, claims, decodedToken.uid);
  if (!effective.ok) {
    return createUnauthenticatedContext(effective.reason);
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || '',
    companyId: effective.companyId,
    globalRole: claims.globalRole,
    mfaEnrolled: claims.mfaEnrolled ?? false,
    isAuthenticated: true,
    superAdminOverride: effective.overridden,
    membershipVerdict: effective.verdict,
  };
}

/**
 * Build request context from NextRequest.
 *
 * This function:
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies token with Firebase Auth
 * 3. Validates RFC v6 custom claims (companyId, globalRole)
 * 4. Returns typed RequestContext
 *
 * @param request - NextRequest object
 * @returns RequestContext (AuthContext | UnauthenticatedContext)
 *
 * @example
 * ```typescript
 * const ctx = await buildRequestContext(request);
 * if (!isAuthenticated(ctx)) {
 *   return NextResponse.json({ error: ctx.reason }, { status: 401 });
 * }
 * // ctx is now typed as AuthContext
 * const { uid, companyId, globalRole } = ctx;
 * ```
 */
export async function buildRequestContext(
  request: NextRequest
): Promise<RequestContext> {
  // Step 1: Try Bearer token from Authorization header (API clients)
  const token = extractBearerToken(request);

  if (token) {
    // Verify ID token, then run the shared claims→context path.
    return contextFromDecodedToken(await verifyIdToken(token), request);
  }

  // Step 2: Try session cookie (__session) — browser clients use credentials: 'include'
  const sessionCookie = extractSessionCookie(request);

  if (sessionCookie) {
    return contextFromDecodedToken(await verifySessionCookie(sessionCookie), request);
  }

  // Step 3: No credentials found — development bypass or reject
  if (process.env.NODE_ENV === 'development') {
    logger.info('[AUTH_CONTEXT] Development mode: bypassing API auth (no token or cookie)');
    return createDevContext();
  }

  return createUnauthenticatedContext('missing_token');
}

/**
 * Create unauthenticated context with reason.
 *
 * @param reason - Unauthentication reason
 * @returns UnauthenticatedContext
 */
function createUnauthenticatedContext(reason: UnauthReason): UnauthenticatedContext {
  return {
    isAuthenticated: false,
    reason,
  };
}

// =============================================================================
// DEVELOPMENT HELPERS
// =============================================================================

/**
 * Create a mock authenticated context for development/testing.
 * NEVER use in production!
 *
 * @param overrides - Partial AuthContext overrides
 * @returns AuthContext
 */
export async function createDevContext(overrides?: Partial<AuthContext>): Promise<AuthContext> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[AUTH_CONTEXT] createDevContext cannot be used in production');
  }

  const companyId = await getDevCompanyId();

  return {
    uid: 'dev-user',
    email: 'dev@localhost',
    companyId,
    globalRole: 'company_admin',
    mfaEnrolled: false,
    isAuthenticated: true,
    ...overrides,
  };
}

// =============================================================================
// RE-EXPORTS FOR CONVENIENCE
// =============================================================================

export type { RequestContext, AuthContext, UnauthenticatedContext };
export { isAuthenticated } from './types';
