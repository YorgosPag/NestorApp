import 'server-only';

/**
 * **POST /api/shares** — γέννηση συνδέσμου κοινοποίησης (ADR-884 Φ0.12 · ADR-315).
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
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createShareOnServer, parseCreateShareRequest } from '@/server/sharing/share-create';
import type { CreateShareResult } from '@/types/sharing';

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

  const outcome = await createShareOnServer(getAdminFirestore(), { uid: ctx.uid, companyId: ctx.companyId }, parsed);
  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.refusal, ...(outcome.reason ? { reason: outcome.reason } : {}) },
      { status: STATUS_OF[outcome.refusal] },
    );
  }
  return NextResponse.json(outcome.result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export const POST = withSensitiveRateLimit(withAuth(handler));
