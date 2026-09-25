import 'server-only';

/**
 * **POST /api/shares/resolve** — «τι βλέπει όποιος ανοίγει αυτόν τον σύνδεσμο;» (ADR-884 Φ0.12).
 *
 * Δημόσια (ο παραλήπτης είναι εξ ορισμού ανώνυμος) — `withAuth` με `allowUnauthenticated`,
 * ώστε και αυτή η πράξη να εκτελείται **μία** φορά ανά `Idempotency-Key` (CHECK 3.92).
 *
 * 🔑 **Το διακριτικό σε ΣΩΜΑ, όχι σε διεύθυνση** (RFC 6819 §5.1.5): μια διεύθυνση API
 * γράφεται σε access logs, proxies και `Referer`. Και ο **κωδικός** φυσικά μόνο σε σώμα.
 *
 * 🔑 **Όριο ρυθμού SENSITIVE** (ανά IP) — μαζί με το κλείδωμα **ανά σύνδεσμο** του
 * `share-password-attempt.ts`, ώστε να μη μαντεύεται κωδικός ούτε από μία IP ούτε από χίλιες.
 *
 * Μετά από σωστό κωδικό γράφεται cookie κουπονιού πρόσβασης (`HttpOnly`, 15′, `Path=/api`),
 * που ανοίγει και τα payload/PDF του showcase **χωρίς** να ξαναζητηθεί ο κωδικός.
 *
 * @module api/shares/resolve
 * @see src/server/sharing/share-resolve.ts
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { attachShareAccessGrant, requestHasShareAccessGrant } from '@/server/sharing/share-access-grant';
import { readShareRequestBody } from '@/server/sharing/share-request-body';
import { resolvePublicShare } from '@/server/sharing/share-resolve';
import type { ShareResolveOutcome } from '@/services/sharing/share-resolve-contract';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

async function handler(request: NextRequest): Promise<NextResponse<ShareResolveOutcome>> {
  const body = await readShareRequestBody(request);
  if (body === null) {
    return NextResponse.json({ status: 'refused', reason: 'not-found' }, { status: 404, headers: NO_STORE });
  }

  const { outcome, grant } = await resolvePublicShare({
    adminDb: getAdminFirestore(),
    token: body.token,
    password: body.password,
    hasGrant: (shareId) => requestHasShareAccessGrant(request, shareId),
  });

  // 200 για κάθε **απάντηση** της ροής (και για τις αρνήσεις): η σελίδα διακλαδώνεται στο
  // `status`/`reason` — ένα 4xx θα την έστελνε σε γενικό «σφάλμα δικτύου».
  const response = NextResponse.json(outcome, { status: 200, headers: NO_STORE });
  if (grant !== null) attachShareAccessGrant(response, grant.shareId, grant.value);
  return response;
}

export const POST = withSensitiveRateLimit(withAuth<ShareResolveOutcome>(handler, { allowUnauthenticated: true }));
