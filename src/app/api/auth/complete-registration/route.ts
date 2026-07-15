/**
 * =============================================================================
 * COMPLETE USER REGISTRATION - AUTHENTICATION API
 * =============================================================================
 *
 * Post-signup onboarding endpoint. ADR-660: ΔΕΝ χορηγεί πλέον αυτόματα tenant +
 * ρόλο `external_user`. Αντ' αυτού δημιουργεί εγγραφή σε κατάσταση **pending**
 * (χωρίς claims / companyId / member doc) και ειδοποιεί τους διαχειριστές. Η
 * πρόσβαση δίνεται ΜΟΝΟ μετά από ρητή έγκριση admin (κονσόλα Διαχείρισης Ρόλων).
 *
 * Καλείται από τον client μετά το createUserWithEmailAndPassword (non-blocking).
 * Η πραγματική λογική ζει στο SSoT `ensurePendingRegistration` — το ίδιο service
 * καλεί και το `POST /api/auth/session` (universal login chokepoint).
 *
 * @module api/auth/complete-registration
 * @enterprise ADR-660 — Self-registration hardening (pending / admin-approval)
 *
 * 🔒 SECURITY: Requires only Firebase Auth (authenticated user calls for self)
 * - Rate Limit: STANDARD (100 req/min)
 * - Idempotent: pending record + notify-once (race-proof στο service)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { ensurePendingRegistration } from '@/server/auth/pending-registration';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('COMPLETE_REGISTRATION');

// ============================================================================
// TYPES
// ============================================================================

interface CompleteRegistrationResponse {
  success: boolean;
  message: string;
  /** `pending` = εκκρεμεί έγκριση admin· `assigned` = έχει ήδη tenant. */
  status?: 'pending' | 'assigned';
  error?: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * POST /api/auth/complete-registration
 *
 * Ο αυθεντικοποιημένος χρήστης καλεί για τον εαυτό του μετά το signup.
 * Δημιουργεί pending record — ΔΕΝ δίνει πρόσβαση.
 */
export const POST = withStandardRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext): Promise<NextResponse<CompleteRegistrationResponse>> => {
      return handleCompleteRegistration(req, ctx);
    }
  )
);

async function handleCompleteRegistration(
  _request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<CompleteRegistrationResponse>> {
  const startTime = Date.now();

  try {
    const result = await ensurePendingRegistration({
      uid: ctx.uid,
      email: ctx.email ?? '',
      authProvider: 'password',
    });

    logger.info('Registration processed', {
      durationMs: Date.now() - startTime,
      uid: ctx.uid,
      status: result.status,
      notified: result.notified,
    });

    if (result.status === 'assigned') {
      return NextResponse.json({
        success: true,
        message: 'User already assigned to a company',
        status: 'assigned',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Registration received — pending administrator approval',
      status: 'pending',
    });
  } catch (error) {
    logger.error('Unexpected error', {
      durationMs: Date.now() - startTime,
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
