/**
 * GET + PUT /api/settings/ai-processing — επεξεργασία από πάροχο AI ανά σκοπό, απόφαση του διαχειριστή (ADR-929 Δ15 #1).
 *
 * GET: η ενεργή κατάσταση κάθε σκοπού (επιλογή + νομική γνωστοποίηση) και αν ο καλών μπορεί να την αλλάξει.
 * PUT: `{ purpose, state }` — μόνο `ADMINISTRATIVE_ROLES` (ADR-801 §2.11), το ίδιο ταβάνι με το `org-structure`.
 *
 * Αποθήκευση/ιστορικό: `server/company/company-ai-processing.server.ts` (ο ένας γραφέας).
 *
 * @module api/settings/ai-processing
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { ADMINISTRATIVE_ROLES, withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { readAiPurposeStatuses, setCompanyAiPurpose } from '@/server/company/company-ai-processing.server';
import {
  isAiProcessingPurpose,
  isAiProcessingState,
  type AiProcessingSettingsResponse,
} from '@/types/company-ai-processing';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('api/settings/ai-processing');

type ErrorBody = { readonly error: string };

/** Το ίδιο ταβάνι με το PUT, ώστε η οθόνη να μη δείχνει διακόπτη που ο διακομιστής θα αρνηθεί. */
function canEdit(ctx: AuthContext): boolean {
  return ADMINISTRATIVE_ROLES.includes(ctx.globalRole);
}

async function responseFor(ctx: AuthContext): Promise<AiProcessingSettingsResponse> {
  return { purposes: await readAiPurposeStatuses(ctx.companyId), canEdit: canEdit(ctx) };
}

async function handleGet(
  _req: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<AiProcessingSettingsResponse | ErrorBody>> {
  try {
    return NextResponse.json(await responseFor(ctx));
  } catch (err) {
    logger.error('read failed', { companyId: ctx.companyId, err });
    return NextResponse.json({ error: 'ai-processing-unreadable' }, { status: 503 });
  }
}

async function handlePut(
  req: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<AiProcessingSettingsResponse | ErrorBody>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const { purpose, state } = (body ?? {}) as Record<string, unknown>;
  if (!isAiProcessingPurpose(purpose) || !isAiProcessingState(state)) {
    return NextResponse.json({ error: 'invalid-purpose-or-state' }, { status: 400 });
  }
  try {
    await setCompanyAiPurpose(ctx.companyId, purpose, state, { uid: ctx.uid, displayName: null });
    return NextResponse.json(await responseFor(ctx));
  } catch (err) {
    logger.error('write failed', { companyId: ctx.companyId, purpose, err });
    return NextResponse.json({ error: 'ai-processing-write-failed' }, { status: 500 });
  }
}

export const GET = withStandardRateLimit(async function GET(request: NextRequest) {
  return withAuth<AiProcessingSettingsResponse | ErrorBody>(handleGet)(request);
});

export const PUT = withStandardRateLimit(async function PUT(request: NextRequest) {
  return withAuth<AiProcessingSettingsResponse | ErrorBody>(handlePut, {
    requiredGlobalRoles: ADMINISTRATIVE_ROLES,
    idempotency: {
      mode: 'natural',
      why: 'ορίζει κατάσταση (enabled/disabled) — η επανάληψη βρίσκει την ίδια τιμή και ο γραφέας δεν γράφει ούτε ιστορικό',
    },
  })(request);
});
