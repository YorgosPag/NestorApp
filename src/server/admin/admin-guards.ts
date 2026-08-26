import 'server-only';

/**
 * 🔐 ENTERPRISE: Centralized Admin Guards Module
 *
 * Server-only module providing:
 * - Firebase Admin SDK initialization (Auth + Firestore)
 * - ID token verification with role claim gating
 * - Environment security enforcement (via centralized config)
 * - Structured audit logging
 * - Server-only collection names (zero hardcoded strings in routes)
 *
 * Split (ADR-065 Phase 5):
 * - admin-guards-types.ts      → Types, interfaces, constants
 * - admin-guards-page-auth.ts  → Server Component auth (requireAdminForPage)
 * - admin-guards.ts (this)     → API auth, verification, audit
 *
 * @serverOnly This module must only be used in server-side code (API routes)
 */

import type { DecodedIdToken } from 'firebase-admin/auth';
import type { NextRequest } from 'next/server';
import {
  validateEnvironmentForOperation,
  getCurrentRuntimeEnvironment,
} from '@/config/environment-security-config';
import {
  getAdminAuth,
} from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AdminGuards');

// Re-export all types for backward compatibility
export type {
  AdminContext,
  UserContext,
  UserAuthResult,
  AdminRole,
  AuthResult,
  AuditEntry,
  StaffContext,
  StaffAuthResult,
  ServerCollectionKey,
} from './admin-guards-types';

export {
  ADMIN_ROLES,
  roleRequiresMfa,
  SERVER_COLLECTIONS,
} from './admin-guards-types';

// Re-export page auth for backward compatibility
export { requireAdminForPage } from './admin-guards-page-auth';

import type {
  AdminContext,
  AdminRole,
  AuthResult,
  AuditEntry,
} from './admin-guards-types';

import { ADMIN_ROLES, roleRequiresMfa } from './admin-guards-types';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// FIREBASE ADMIN — DELEGATED TO CANONICAL MODULE
// ============================================================================
// ADR-077: All Firebase Admin initialization is handled by src/lib/firebaseAdmin.ts
export { getAdminFirestore } from '@/lib/firebaseAdmin';

// ============================================================================
// FIREBASE AUTH VERIFICATION
// ============================================================================

const AUTHORIZATION_HEADER = 'authorization';

/** Extract Bearer token from Authorization header */
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get(AUTHORIZATION_HEADER);
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify Firebase ID token and extract claims
 * ADR-077: Uses canonical getAdminAuth() from firebaseAdmin.ts
 */
async function verifyIdToken(token: string): Promise<DecodedIdToken | null> {
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    logger.info('[ADMIN_GUARDS] Token verification failed:', (error as Error).message);
    return null;
  }
}

/**
 * Verify Firebase session cookie and extract claims.
 * Used for Server Component auth via __session cookie.
 * Exported for use by admin-guards-page-auth.ts
 */
export async function verifySessionCookieToken(sessionCookie: string): Promise<DecodedIdToken | null> {
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifySessionCookie(sessionCookie, false);
    return decodedToken;
  } catch (error) {
    logger.info('[ADMIN_GUARDS] Session cookie verification failed:', (error as Error).message);
    return null;
  }
}

/**
 * Ο ρόλος διαχειριστή **του token** — ή `null`.
 *
 * =============================================================================
 * 🔴 ΤΙ ΕΦΥΓΕ ΑΠΟ ΕΔΩ, ΚΑΙ ΓΙΑΤΙ (ADR-813 Φάση Β)
 * =============================================================================
 *
 * Η συνάρτηση είχε **τέσσερις** πηγές αλήθειας, με την τελευταία σημειωμένη ως
 * *«PRIMARY METHOD»*. Καμία δεν επιβίωσε τη μέτρηση:
 *
 * | πηγή | μετρημένο ζωντανά (5 λογαριασμοί παραγωγής) |
 * |---|---|
 * | `globalRole` claim | ✅ **η μόνη που απαντά** |
 * | `role` claim *(legacy)* | **0** λογαριασμοί το φέρουν ⇒ νεκρός κλάδος |
 * | `admin === true` *(legacy)* | **0** λογαριασμοί το φέρουν ⇒ νεκρός κλάδος |
 * | **`NEXT_PUBLIC_ADMIN_EMAILS`** | 🔴 **η αυθεντία που έπρεπε να φύγει** |
 *
 * 🔑 **ΓΙΑΤΙ Η ΛΙΣΤΑ EMAIL ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΕΙΝΑΙ ΑΥΘΕΝΤΙΑ** (ADR-813 §3): παγώνει
 *    στο build (*«all `NEXT_PUBLIC_` variables will be **frozen** with the value
 *    evaluated at build time»*) ⇒ **η ανάκληση διαχειριστή απαιτούσε redeploy**.
 *    Και ο πελάτης με τον server μπορούσαν να διαβάζουν **διαφορετική** λίστα:
 *    του πελάτη παγώνει στο workflow, του server έρχεται από το Coolify.
 *    Επιπλέον **3 στα 5** email ήταν **φαντάσματα** — λογαριασμοί που δεν
 *    υπήρχαν, δηλαδή διαχειριστικές θέσεις που διεκδικούνταν με μια εγγραφή.
 *
 * ⚠️ **ΟΙ ΔΥΟ LEGACY ΚΛΑΔΟΙ ΔΕΝ ΕΦΥΓΑΝ ΕΠΕΙΔΗ «ΦΑΙΝΟΝΤΑΝ ΠΑΛΙΟΙ»** — έφυγαν
 *    επειδή ο τύπος τους απαγόρευσε: επέστρεφαν `'admin'`, όνομα που **δεν
 *    υπάρχει** στο `GlobalRole`. Μετρήθηκε **πρώτα** ο πληθυσμός τους (0/5) και
 *    **μετά** διαγράφηκαν· η σειρά έχει σημασία, γιατί «φαίνεται νεκρό» και
 *    «είναι νεκρό» είναι δύο διαφορετικά πράγματα.
 *
 * 🏆 **ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΕΙΝΑΙ ΤΟ ΠΡΟΤΥΠΟ ΤΩΝ ΜΕΓΑΛΩΝ**: ο PEP δεν κρίνει πια μόνος
 *    του — καταναλώνει **παραγόμενο** σύνολο από το SSoT. NIST SP 800-162 /
 *    SP 800-207: *«the PEP … contains **no clever logic of its own**»*.
 *
 * ⛔ **ΜΗΝ ξαναφέρεις εδώ λίστα email, μεταβλητή περιβάλλοντος, ή ονόματα
 *    ρόλων.** Το ταβάνι είναι το `ADMIN_ROLES`, και **παράγεται**.
 *
 * @param decodedToken Το επαληθευμένο token.
 * @returns Ο ρόλος, ή `null` όταν το token δεν φέρει διαχειριστικό ρόλο.
 * @see lib/auth/roles.ts — `ADMINISTRATIVE_ROLES`, η παραγωγή
 * @see server/admin/admin-guards-types.ts — γιατί ταβάνι και όχι ικανότητα
 */
export function hasAdminRole(decodedToken: DecodedIdToken): AdminRole | null {
  const globalRole = (decodedToken as Record<string, unknown>).globalRole as string | undefined;

  // Ο ρόλος του **token**, κριμένος με το **παραγόμενο** ταβάνι. Καμία άλλη
  // πηγή: όχι email, όχι legacy claims, όχι μεταβλητή περιβάλλοντος.
  if (globalRole && ADMIN_ROLES.includes(globalRole as AdminRole)) {
    logger.info(`🔐 [admin-guards] Role from globalRole claim: ${globalRole}`);
    return globalRole as AdminRole;
  }

  return null;
}

// ============================================================================
// MAIN AUTHENTICATION — requireAdminContext
// ============================================================================

/**
 * Require admin authentication for a request
 *
 * Gates: Environment → Token → Firebase verify → Admin role → MFA
 *
 * @param request - NextRequest object
 * @param operationId - Unique operation ID for audit trail
 * @returns AuthResult with success status and context or error
 */
export async function requireAdminContext(
  request: NextRequest,
  operationId: string
): Promise<AuthResult> {
  const environment = getCurrentRuntimeEnvironment();

  // Gate 1: Environment check
  const envValidation = validateEnvironmentForOperation('requireAdminContext');
  if (!envValidation.allowed) {
    return {
      success: false,
      error: envValidation.reason || `Operation not allowed in ${environment} environment`,
    };
  }

  // Gate 2: Extract token
  const token = extractBearerToken(request);

  // Development bypass (when no token and in development)
  if (!token && environment === 'development') {
    logger.info('[ADMIN_GUARDS] Development mode: bypassing auth (no token provided)');
    return {
      success: true,
      context: {
        uid: 'dev-admin',
        email: 'dev@localhost',
        role: 'admin',
        operationId,
        environment,
        mfaEnrolled: true,
      },
    };
  }

  if (!token) {
    return {
      success: false,
      error: 'Missing Authorization header with Bearer token',
    };
  }

  // Gate 3: Verify token
  const decodedToken = await verifyIdToken(token);
  if (!decodedToken) {
    return {
      success: false,
      error: 'Invalid or expired authentication token',
    };
  }

  // Gate 4: Check admin role
  const role = hasAdminRole(decodedToken);
  if (!role) {
    return {
      success: false,
      error: 'User does not have admin privileges',
    };
  }

  // Gate 5: MFA Enforcement (PR-1B)
  const mfaEnrolled = decodedToken.mfaEnrolled === true;

  if (roleRequiresMfa(role) && !mfaEnrolled) {
    logger.info(`🔐 [ADMIN_GUARDS] MFA DENIED: User ${decodedToken.email} (${role}) - MFA not enrolled`);
    return {
      success: false,
      error: `MFA enrollment required for ${role} role. Please enable two-factor authentication.`,
    };
  }

  return {
    success: true,
    context: {
      uid: decodedToken.uid,
      email: decodedToken.email || 'unknown',
      role,
      operationId,
      environment,
      mfaEnrolled,
    },
  };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Create structured audit log entry
 */
export function audit(
  operationId: string,
  operation: string,
  details: Record<string, unknown>,
  context?: AdminContext
): void {
  const entry: AuditEntry = {
    timestamp: nowISO(),
    operationId,
    operation,
    environment: context?.environment || process.env.NODE_ENV || 'unknown',
    uid: context?.uid,
    role: context?.role,
    details,
  };

  logger.info(`[AUDIT] ${JSON.stringify(entry)}`);
}
