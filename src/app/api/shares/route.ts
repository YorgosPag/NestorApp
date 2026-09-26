import 'server-only';

/**
 * **POST /api/shares** — γέννηση συνδέσμου κοινοποίησης (ADR-884 Φ0.12 · ADR-315).
 * **GET /api/shares?entityType&entityId** — οι ενεργοί σύνδεσμοι μιας οντότητας (ADR-315 §5 · Α12):
 * μόνο η ρητή προβολή `ShareLinkSummary` — ποτέ hash, ποτέ διακριτικό. Ξένη οντότητα ⇒ 404.
 *
 * 🔴 Μέχρι το Κ4 ο browser έγραφε το έγγραφο μόνος του (διακριτικό σε καθαρό κείμενο,
 * κωδικός SHA-256 χωρίς salt, έλεγχος ιδιοκτησίας στον browser). Τώρα όλα γίνονται εδώ,
 * και ο μισθωτής/συντάκτης έρχονται από το `withAuth` — **ποτέ** από το σώμα.
 *
 * Απάντηση: `{ shareId, token, expiresAt }` — το ωμό διακριτικό ταξιδεύει **μία** φορά.
 *
 * @module api/shares
 * @see src/server/sharing/share-create.ts
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createShareOnServer, parseCreateShareRequest } from '@/server/sharing/share-create';
import { listActiveShareLinks, parseShareEntityRef } from '@/server/sharing/share-links-list';
import { shareRefusalResponse } from '@/server/sharing/share-refusal-response';
import type { CreateShareResult, ShareLinksListResult } from '@/types/sharing';

interface ShareCreateError {
  readonly error: 'malformed' | 'invalid' | 'forbidden';
  readonly reason?: string;
}

const STATUS_OF: Record<ShareCreateError['error'], number> = { malformed: 400, invalid: 422, forbidden: 403 };

async function handler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<CreateShareResult | ShareCreateError>> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseCreateShareRequest(body);
  if (parsed === null) return NextResponse.json({ error: 'malformed' }, { status: STATUS_OF.malformed });

  const outcome = await createShareOnServer(getAdminFirestore(), {
    uid: ctx.uid,
    companyId: ctx.companyId,
    // ADR-884 Κ3β: είδη που κρίνουν δυνατότητα (σύνδεσμος περιήγησης) χρειάζονται την όψη ρόλου.
    capability: { globalRole: ctx.globalRole, permissions: ctx.permissions ?? null, companyId: ctx.companyId },
  }, parsed);
  if (!outcome.ok) return shareRefusalResponse(outcome.refusal, outcome.reason, STATUS_OF);
  return NextResponse.json(outcome.result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export const POST = withSensitiveRateLimit(withAuth(handler));

type ShareListError = { readonly error: 'malformed' | 'not-found' };

async function listHandler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ShareLinksListResult | ShareListError>> {
  const params = request.nextUrl.searchParams;
  const ref = parseShareEntityRef({ entityType: params.get('entityType'), entityId: params.get('entityId') });
  if (ref === null) return NextResponse.json({ error: 'malformed' }, { status: 400 });
  const result = await listActiveShareLinks(getAdminFirestore(), ctx.companyId, ref);
  if (result === null) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = withStandardRateLimit(withAuth(listHandler));
