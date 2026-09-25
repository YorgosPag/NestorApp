import 'server-only';

/**
 * **PATCH /api/shares/[shareId]** — αλλαγή ρυθμίσεων συνδέσμου **χωρίς αλλαγή URL**
 * (ADR-315 Α13, πρότυπο Dropbox / Box «Link settings»). Επιστρέφει τη νέα σύνοψη.
 * Ξένος, ανύπαρκτος ή ανακληθείς σύνδεσμος ⇒ 404.
 *
 * @module api/shares/[shareId]
 * @see src/server/sharing/share-update.ts
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { shareRefusalResponse, type ShareRefusalBody } from '@/server/sharing/share-refusal-response';
import {
  parseUpdateShareRequest,
  updateShareOnServer,
  type ShareUpdateRefusal,
} from '@/server/sharing/share-update';
import type { ShareLinkSummary } from '@/types/sharing';

type RouteContext = { params: Promise<{ shareId: string }> };
type ShareUpdateError = ShareRefusalBody<ShareUpdateRefusal>;
type ShareUpdateResponse = { readonly link: ShareLinkSummary } | ShareUpdateError;

const STATUS_OF: Record<ShareUpdateRefusal, number> = { malformed: 400, invalid: 422, 'not-found': 404 };

async function handler(
  request: NextRequest,
  ctx: AuthContext,
  _cache: unknown,
  routeContext?: RouteContext,
): Promise<NextResponse<ShareUpdateResponse>> {
  const shareId = decodeRouteParam((await routeContext?.params)?.shareId ?? '');
  const parsed = parseUpdateShareRequest(await request.json().catch(() => null));
  if (shareId === '' || parsed === null) return NextResponse.json({ error: 'malformed' }, { status: 400 });

  const outcome = await updateShareOnServer(
    getAdminFirestore(), { uid: ctx.uid, companyId: ctx.companyId }, shareId, parsed,
  );
  if (!outcome.ok) return shareRefusalResponse(outcome.refusal, outcome.reason, STATUS_OF);
  return NextResponse.json({ link: outcome.link }, { headers: { 'Cache-Control': 'no-store' } });
}

export const PATCH = withSensitiveRateLimit(withAuth<ShareUpdateResponse, RouteContext>(handler));
