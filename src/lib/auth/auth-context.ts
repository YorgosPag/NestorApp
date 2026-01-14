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

import { getApps, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import type { NextRequest } from 'next/server';

import type {
  AuthContext,
  UnauthenticatedContext,
  RequestContext,
  GlobalRole,
  CustomClaims,
} from './types';
import { isValidGlobalRole } from './types';

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
// FIREBASE ADMIN ACCESS (No duplicate initialization!)
// =============================================================================

/**
 * Get existing Firebase Admin App instance.
 *
 * IMPORTANT: This module does NOT initialize Firebase Admin.
 * It relies on the centralized initialization in:
 * - src/server/admin/admin-guards.ts (for API routes)
 * - src/lib/firebase-admin.ts (for services)
 *
 * Call those modules first if Admin SDK is not initialized.
 *
 * @returns Firebase App instance or null
 */
function getAdminApp(): App | null {
  // Skip client-side
  if (typeof window !== 'undefined') {
    return null;
  }

  // Return existing app if already initialized by centralized modules
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  // No app initialized - caller should ensure centralized init was called
  console.warn('[AUTH_CONTEXT] Firebase Admin not initialized. Ensure admin-guards.ts or firebase-admin.ts is imported first.');
  return null;
}

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
    const app = getAdminApp();
    if (!app) {
      console.log('[AUTH_CONTEXT] Cannot verify token - Admin SDK not initialized');
      return null;
    }

    const auth = getAuth(app);
    return await auth.verifyIdToken(token);
  } catch (error) {
    console.log('[AUTH_CONTEXT] Token verification failed:', (error as Error).message);
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
  // Extract companyId (required for multi-tenant)
  const companyId = token.companyId as string | undefined;
  if (!companyId || typeof companyId !== 'string') {
    console.log('[AUTH_CONTEXT] Missing companyId claim');
    return null;
  }

  // Extract globalRole (required)
  const globalRoleRaw = token.globalRole as string | undefined;
  if (!globalRoleRaw || !isValidGlobalRole(globalRoleRaw)) {
    console.log('[AUTH_CONTEXT] Invalid globalRole claim:', globalRoleRaw);
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
  // Step 1: Extract token
  const token = extractBearerToken(request);
  if (!token) {
    return createUnauthenticatedContext('missing_token');
  }

  // Step 2: Verify token
  const decodedToken = await verifyIdToken(token);
  if (!decodedToken) {
    return createUnauthenticatedContext('invalid_token');
  }

  // Step 3: Extract RFC v6 claims
  const claims = extractCustomClaims(decodedToken);
  if (!claims) {
    return createUnauthenticatedContext('missing_claims');
  }

  // Step 4: Build authenticated context
  return {
    uid: decodedToken.uid,
    email: decodedToken.email || '',
    companyId: claims.companyId,
    globalRole: claims.globalRole,
    mfaEnrolled: claims.mfaEnrolled ?? false,
    isAuthenticated: true,
  };
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
export function createDevContext(overrides?: Partial<AuthContext>): AuthContext {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[AUTH_CONTEXT] createDevContext cannot be used in production');
  }

  return {
    uid: 'dev-user',
    email: 'dev@localhost',
    companyId: 'dev-company',
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
