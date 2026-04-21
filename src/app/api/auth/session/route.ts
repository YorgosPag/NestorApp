/**
 * =============================================================================
 * AUTH SESSION COOKIE ENDPOINT
 * =============================================================================
 *
 * Creates/clears Firebase Auth session cookie for server-side admin pages.
 * Required for production access to Server Components that rely on __session.
 *
 * POST  /api/auth/session   -> sets __session cookie
 * DELETE /api/auth/session  -> clears __session cookie
 *
 * @module api/auth/session
 * @enterprise Security Policy: SESSION_POLICY + SESSION_COOKIE_CONFIG (SSoT)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getCurrentRuntimeEnvironment } from '@/config/environment-security-config';
import { SESSION_COOKIE_CONFIG, getSessionCookieDurationMs } from '@/lib/auth/security-policy';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { ensureCompanyDocument } from '@/services/company-document.service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AuthSession');

// ============================================================================
// TYPES
// ============================================================================

interface SessionCreateRequest {
  idToken: string;
}

interface SessionResponse {
  success: boolean;
  message: string;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  const environment = getCurrentRuntimeEnvironment();
  const isProduction = environment === 'production';
  const durationMs = getSessionCookieDurationMs();
  const maxAgeSeconds = Math.floor(durationMs / 1000);

  return {
    httpOnly: SESSION_COOKIE_CONFIG.HTTP_ONLY,
    secure: isProduction,
    sameSite: SESSION_COOKIE_CONFIG.SAME_SITE,
    path: SESSION_COOKIE_CONFIG.PATH,
    maxAge: maxAgeSeconds,
  };
}

function buildClearCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  const environment = getCurrentRuntimeEnvironment();
  const isProduction = environment === 'production';

  return {
    httpOnly: SESSION_COOKIE_CONFIG.HTTP_ONLY,
    secure: isProduction,
    sameSite: SESSION_COOKIE_CONFIG.SAME_SITE,
    path: SESSION_COOKIE_CONFIG.PATH,
    maxAge: 0,
  };
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
const postHandler = async (request: NextRequest): Promise<NextResponse<SessionResponse>> => {
  try {
    const adminAuth = getAdminAuth();

    const body: SessionCreateRequest = await request.json();
    const { idToken } = body;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request',
          error: 'idToken is required and must be a string',
        },
        { status: 400 }
      );
    }

    const expiresIn = getSessionCookieDurationMs();

    // Verify token + create session cookie in parallel
    const [sessionCookie, decodedToken] = await Promise.all([
      adminAuth.createSessionCookie(idToken, { expiresIn }),
      adminAuth.verifyIdToken(idToken),
    ]);

    // Proactive workspace bootstrap — fire-and-forget (ADR-316)
    // Creates companies/{companyId} at login time, before any action fires.
    // Eliminates the audit-system race condition for company doc creation.
    const uid = decodedToken.uid;
    const companyId = decodedToken.companyId as string | undefined;
    if (companyId && uid) {
      ensureCompanyDocument(companyId, undefined, uid).catch((err: unknown) => {
        logger.warn('[Session] Workspace bootstrap failed (non-blocking)', {
          uid,
          companyId,
          error: getErrorMessage(err),
        });
      });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Session cookie created',
    });

    response.cookies.set(
      SESSION_COOKIE_CONFIG.NAME,
      sessionCookie,
      buildSessionCookieOptions()
    );

    return response;
  } catch (error) {
    const message = getErrorMessage(error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create session cookie',
        error: message,
      },
      { status: 401 }
    );
  }
};

export const POST = withSensitiveRateLimit(postHandler);

/**
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
const deleteHandler = async (): Promise<NextResponse<SessionResponse>> => {
  const response = NextResponse.json({
    success: true,
    message: 'Session cookie cleared',
  });

  response.cookies.set(
    SESSION_COOKIE_CONFIG.NAME,
    '',
    buildClearCookieOptions()
  );

  return response;
};

export const DELETE = withSensitiveRateLimit(deleteHandler);
