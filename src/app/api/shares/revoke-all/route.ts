import 'server-only';

/**
 * **POST /api/shares/revoke-all** — «Ανάκληση όλων» (προαιρετικά «εκτός από αυτόν») για μία
 * οντότητα (ADR-315 §5). Μονόδρομη και ιδεμποτική: δεύτερη κλήση ⇒ `{ revoked: 0 }`.
 * Ξένη ή ανύπαρκτη οντότητα ⇒ 404 (Α10).
 *
 * @module api/shares/revoke-all
 * @see src/server/sharing/share-revoke.ts
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { parseRevokeAllRequest } from '@/server/sharing/share-links-list';
import { revokeAllShareLinks } from '@/server/sharing/share-revoke';
import type { RevokeAllSharesResult } from '@/types/sharing';

type RevokeAllError = { readonly error: 'malformed' | 'not-found' };

async function handler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<RevokeAllSharesResult | RevokeAllError>> {
  const parsed = parseRevokeAllRequest(await request.json().catch(() => null));
  if (parsed === null) return NextResponse.json({ error: 'malformed' }, { status: 400 });
  const revoked = await revokeAllShareLinks(getAdminFirestore(), { uid: ctx.uid, companyId: ctx.companyId }, parsed);
  if (revoked === null) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  return NextResponse.json({ revoked });
}

export const POST = withSensitiveRateLimit(withAuth<RevokeAllSharesResult | RevokeAllError>(handler));
