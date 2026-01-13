import 'server-only';

import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

/**
 * ENTERPRISE: Centralized Admin Guards Module
 *
 * Server-only module providing:
 * - Firebase Admin SDK initialization (Auth + Firestore)
 * - ID token verification with role claim gating
 * - Environment allowlist enforcement
 * - Structured audit logging
 * - Server-only collection names (zero hardcoded strings in routes)
 *
 * @serverOnly This module must only be used in server-side code (API routes)
 * @author Enterprise Architecture Team
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Admin context returned after successful authentication
 */
export interface AdminContext {
  uid: string;
  email: string;
  role: AdminRole;
  operationId: string;
  environment: string;
}

/**
 * Supported admin roles from Firebase custom claims
 */
export type AdminRole = 'admin' | 'broker' | 'builder';

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  error?: string;
  context?: AdminContext;
}

/**
 * Audit log entry structure
 */
export interface AuditEntry {
  timestamp: string;
  operationId: string;
  operation: string;
  environment: string;
  uid?: string;
  role?: AdminRole;
  details: Record<string, unknown>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ALLOWED_ENVIRONMENTS = ['development', 'staging', 'test'] as const;
const ADMIN_ROLES: AdminRole[] = ['admin', 'broker', 'builder'];
const AUTHORIZATION_HEADER = 'authorization';

// ============================================================================
// SERVER-ONLY COLLECTIONS (ZERO HARDCODED STRINGS IN ROUTES)
// ============================================================================

/**
 * Server-only Firestore collection names
 * These collections should NEVER be imported in client code
 * Routes MUST use these constants instead of hardcoded strings
 */
export const SERVER_COLLECTIONS = {
  /** Admin building templates - source of truth for seed/populate */
  ADMIN_BUILDING_TEMPLATES: 'admin_building_templates',
  /** Buildings collection - main buildings data */
  BUILDINGS: 'buildings',
  /** Audit logs */
  AUDIT_LOGS: 'audit_logs',
} as const;

export type ServerCollectionKey = keyof typeof SERVER_COLLECTIONS;

// ============================================================================
// FIREBASE ADMIN INITIALIZATION
// ============================================================================

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

/**
 * Initialize Firebase Admin SDK (singleton pattern)
 * Returns null if initialization fails or in invalid environment
 */
function initializeAdmin(): App | null {
  // Skip client-side or test environment
  if (typeof window !== 'undefined') {
    return null;
  }

  // Return existing app if already initialized
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  try {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!projectId) {
      console.log('[ADMIN_GUARDS] No project ID found, skipping initialization');
      return null;
    }

    // Initialize with service account if available
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId,
        });
        console.log('[ADMIN_GUARDS] Firebase Admin initialized with service account');
      } catch (parseError) {
        console.log('[ADMIN_GUARDS] Failed to parse service account, using default credentials');
        adminApp = initializeApp({ projectId });
      }
    } else {
      // Development fallback
      adminApp = initializeApp({ projectId });
      console.log('[ADMIN_GUARDS] Firebase Admin initialized with default credentials');
    }

    return adminApp;
  } catch (error) {
    console.error('[ADMIN_GUARDS] Firebase Admin initialization failed:', error);
    return null;
  }
}

/**
 * Get Firebase Admin Firestore instance
 * Use this instead of client SDK in admin routes
 */
export function getAdminFirestore(): Firestore {
  if (!adminDb) {
    const app = initializeAdmin();
    if (!app) {
      throw new Error('[ADMIN_GUARDS] Firebase Admin not initialized');
    }
    adminDb = getFirestore(app);
  }
  return adminDb;
}

// ============================================================================
// ENVIRONMENT GATING
// ============================================================================

/**
 * Check if current environment is in allowlist
 */
export function isAllowedEnvironment(): boolean {
  const env = process.env.NODE_ENV || 'development';
  return (ALLOWED_ENVIRONMENTS as readonly string[]).includes(env);
}

/**
 * Assert environment is allowed, throws if not
 */
export function assertAllowedEnvironment(): void {
  if (!isAllowedEnvironment()) {
    throw new Error(
      `[ADMIN_GUARDS] Operation not allowed in ${process.env.NODE_ENV} environment`
    );
  }
}

// ============================================================================
// FIREBASE AUTH VERIFICATION
// ============================================================================

/**
 * Extract Bearer token from Authorization header
 */
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
 */
async function verifyIdToken(token: string): Promise<DecodedIdToken | null> {
  try {
    const app = initializeAdmin();
    if (!app) {
      console.log('[ADMIN_GUARDS] Cannot verify token - Admin SDK not initialized');
      return null;
    }

    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.log('[ADMIN_GUARDS] Token verification failed:', (error as Error).message);
    return null;
  }
}

/**
 * Check if decoded token has admin role claim
 */
function hasAdminRole(decodedToken: DecodedIdToken): AdminRole | null {
  // Check custom claims for role
  const role = decodedToken.role as string | undefined;

  if (role && ADMIN_ROLES.includes(role as AdminRole)) {
    return role as AdminRole;
  }

  // Fallback: check if user has admin claim
  if (decodedToken.admin === true) {
    return 'admin';
  }

  return null;
}

// ============================================================================
// MAIN AUTHENTICATION FUNCTION
// ============================================================================

/**
 * Require admin authentication for a request
 *
 * This function:
 * 1. Checks environment allowlist
 * 2. Extracts Bearer token from Authorization header
 * 3. Verifies token with Firebase Auth
 * 4. Checks for admin role in custom claims
 * 5. Returns AdminContext on success
 *
 * @param request - NextRequest object
 * @param operationId - Unique operation ID for audit trail
 * @returns AuthResult with success status and context or error
 *
 * @example
 * ```typescript
 * const authResult = await requireAdminContext(request, operationId);
 * if (!authResult.success) {
 *   return NextResponse.json({ error: authResult.error }, { status: 403 });
 * }
 * const { uid, role } = authResult.context!;
 * ```
 */
export async function requireAdminContext(
  request: NextRequest,
  operationId: string
): Promise<AuthResult> {
  const environment = process.env.NODE_ENV || 'development';

  // Gate 1: Environment check
  if (!isAllowedEnvironment()) {
    return {
      success: false,
      error: `Operation not allowed in ${environment} environment`,
    };
  }

  // Gate 2: Extract token
  const token = extractBearerToken(request);

  // Development bypass (when no token and in development)
  if (!token && environment === 'development') {
    console.log('[ADMIN_GUARDS] Development mode: bypassing auth (no token provided)');
    return {
      success: true,
      context: {
        uid: 'dev-admin',
        email: 'dev@localhost',
        role: 'admin',
        operationId,
        environment,
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

  // Success - return admin context
  return {
    success: true,
    context: {
      uid: decodedToken.uid,
      email: decodedToken.email || 'unknown',
      role,
      operationId,
      environment,
    },
  };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Create structured audit log entry
 *
 * @param operationId - Unique operation ID
 * @param operation - Operation name (e.g., 'SEED_BUILDINGS_START')
 * @param details - Additional details to log
 * @param context - Optional admin context for authenticated operations
 */
export function audit(
  operationId: string,
  operation: string,
  details: Record<string, unknown>,
  context?: AdminContext
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    operationId,
    operation,
    environment: context?.environment || process.env.NODE_ENV || 'unknown',
    uid: context?.uid,
    role: context?.role,
    details,
  };

  // Structured logging for parsing compatibility
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}
