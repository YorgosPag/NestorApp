/**
 * 🛠️ UTILITY: FIRESTORE CONNECTIVITY DIAGNOSTIC
 *
 * Root cause analysis for floors connectivity issues.
 *
 * @module api/floors/diagnostic
 * @version 3.0.0
 * @updated 2026-08-25 - N.7.1: η λογική μετακόμισε στο `floors-diagnostic.handlers.ts`
 *                       (CHECK 4: 386/300 γραμμές — ένα route είναι ΣΥΝΟΡΟ)
 *
 * 🔒 SECURITY:
 * - Global Role: super_admin (break-glass utility)
 * - Admin SDK for secure server-side operations
 *
 * @rateLimit STANDARD (60 req/min) - Firestore connectivity diagnostic utility
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuth, BYPASS_ROLES } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

import { runFloorsDiagnostic } from './floors-diagnostic.handlers';
import type { FirestoreDiagnosticResult } from './floors-diagnostic.types';

const getHandler = async (request: NextRequest) => {
  const handler = withAuth<FirestoreDiagnosticResult>(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse<FirestoreDiagnosticResult>> => {
      const { ok, result } = await runFloorsDiagnostic({
        userId: ctx.uid,
        globalRole: ctx.globalRole,
        companyId: ctx.companyId,
      });

      return ok ? NextResponse.json(result) : NextResponse.json(result, { status: 500 });
    },
    { requiredGlobalRoles: BYPASS_ROLES }
  );

  return handler(request);
};

export const GET = withStandardRateLimit(getHandler);
