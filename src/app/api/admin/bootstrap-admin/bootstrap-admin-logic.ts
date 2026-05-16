import { NextResponse } from 'next/server';
import { isValidGlobalRole } from '@/lib/auth';
import type { GlobalRole } from '@/lib/auth';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BootstrapAdminLogic');

// ============================================================================
// TYPES
// ============================================================================

export interface BootstrapAdminRequest {
  /** Firebase Auth UID ή email του χρήστη */
  userIdentifier: string;
  /** Company ID (tenant anchor) */
  companyId: string;
  /** Global role (default: super_admin) */
  globalRole?: GlobalRole;
  /** Bootstrap secret (required) */
  bootstrapSecret: string;
}

export interface BootstrapAdminResponse {
  success: boolean;
  message: string;
  user?: {
    uid: string;
    email: string;
    companyId: string;
    globalRole: GlobalRole;
    customClaimsSet: boolean;
    firestoreDocCreated: boolean;
  };
  error?: string;
  warning?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const BOOTSTRAP_SECRET =
  process.env.BOOTSTRAP_ADMIN_SECRET || 'change-me-in-production';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validates bootstrap request inputs + secret.
 * Returns an error NextResponse on failure, null on success.
 */
export function validateBootstrapInputs(
  body: BootstrapAdminRequest,
  secret: string
): NextResponse<BootstrapAdminResponse> | null {
  const { userIdentifier, companyId, globalRole = 'super_admin', bootstrapSecret } = body;

  if (!userIdentifier || typeof userIdentifier !== 'string') {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid userIdentifier',
        error: 'userIdentifier is required and must be a string (email or UID)',
      },
      { status: 400 }
    );
  }
  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json(
      { success: false, message: 'Invalid companyId', error: 'companyId is required' },
      { status: 400 }
    );
  }
  if (!isValidGlobalRole(globalRole)) {
    logger.warn('Invalid globalRole', { globalRole });
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid globalRole',
        error: 'globalRole must be one of: super_admin, company_admin, company_staff, company_user',
      },
      { status: 400 }
    );
  }
  if (bootstrapSecret !== secret) {
    logger.warn('BLOCKED: Invalid bootstrap secret');
    return NextResponse.json(
      {
        success: false,
        message: 'Unauthorized',
        error: 'Invalid bootstrap secret. Set BOOTSTRAP_ADMIN_SECRET in environment.',
      },
      { status: 401 }
    );
  }
  return null;
}

// ============================================================================

type LookupResult =
  | { found: true; user: { uid: string; email?: string; displayName?: string | null } }
  | { found: false; errorResponse: NextResponse<BootstrapAdminResponse> };

/**
 * Finds a Firebase Auth user by UID (length > 20) or email.
 */
export async function lookupFirebaseUser(userIdentifier: string): Promise<LookupResult> {
  try {
    const user =
      userIdentifier.length > 20
        ? await getAdminAuth().getUser(userIdentifier)
        : await getAdminAuth().getUserByEmail(userIdentifier);
    logger.info('User found', { email: user.email, uid: user.uid });
    return { found: true, user };
  } catch (error) {
    logger.error('User not found', { error });
    return {
      found: false,
      errorResponse: NextResponse.json(
        {
          success: false,
          message: 'User not found in Firebase Auth',
          error: `No user found with identifier: ${userIdentifier}`,
        },
        { status: 404 }
      ),
    };
  }
}
