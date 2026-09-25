import 'server-only';

/**
 * **POST /api/shares/[shareId]/revoke** — ανάκληση συνδέσμου από τον μισθωτή του (ADR-884 Φ0.12).
 *
 * Μονόδρομη και ιδεμποτική. Ξένος ή ανύπαρκτος σύνδεσμος ⇒ 404 (δεν επιβεβαιώνουμε ids
 * άλλου μισθωτή).
 *
 * @module api/shares/[shareId]/revoke
 * @see src/server/sharing/share-revoke.ts
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { revokeShareOnServer, type ShareRevokeOutcome } from '@/server/sharing/share-revoke';

type RouteContext = { params: Promise<{ shareId: string }> };

async function handler(
  _request: NextRequest,
  ctx: AuthContext,
  _cache: unknown,
  routeContext?: RouteContext,
): Promise<NextResponse<{ outcome: ShareRevokeOutcome }>> {
  const shareId = decodeRouteParam((await routeContext?.params)?.shareId ?? '');
  const outcome = shareId === ''
    ? 'not-found'
    : await revokeShareOnServer(getAdminFirestore(), { uid: ctx.uid, companyId: ctx.companyId }, shareId);
  return NextResponse.json({ outcome }, { status: outcome === 'not-found' ? 404 : 200 });
}

export const POST = withStandardRateLimit(withAuth<{ outcome: ShareRevokeOutcome }, RouteContext>(handler));
