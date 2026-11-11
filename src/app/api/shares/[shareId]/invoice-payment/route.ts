import 'server-only';

/**
 * **GET /api/shares/[shareId]/invoice-payment** — η όψη του τιμολογίου για τον κάτοχο του συνδέσμου (ADR-ACC-018 §16).
 *
 * Δημόσια (ο πελάτης δεν έχει λογαριασμό): `withAuth` με `allowUnauthenticated`. Απαιτεί το **κουπόνι επίσκεψης**
 * του συνδέσμου (`HttpOnly` cookie, 15′, γράφεται από το `POST /api/shares/resolve`), ώστε η όψη να τη λαμβάνει
 * μόνο browser που **άνοιξε** τον σύνδεσμο με το token. Το token δεν εμφανίζεται ποτέ σε αυτή τη διεύθυνση.
 *
 * GET χωρίς εγγραφή ⇒ εκτός ορίου ιδεμποτίας (CHECK 3.92 κρίνει μόνο μεταλλάξεις). Όριο ρυθμού STANDARD.
 * Κεφαλίδες `no-store` + `noindex`: κανένα cache ενδιάμεσου, κανένα ευρετήριο.
 *
 * @module api/shares/[shareId]/invoice-payment
 * @see src/server/accounting/public-invoice/invoice-public-session.ts
 */

import { NextResponse, type NextRequest } from 'next/server';

import { PRIVATE_CHANNEL_HEADERS } from '@/lib/http/private-response-headers';
import { withAuth } from '@/lib/auth/middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { openInvoicePublicView } from '@/server/accounting/public-invoice/invoice-public-session';
import { requestHasShareAccessGrant } from '@/server/sharing/share-access-grant';
import type { InvoicePublicViewResponse } from '@/subapps/accounting/types/invoice-public-view';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ shareId: string }> };

async function handler(
  request: NextRequest,
  _ctx: unknown,
  _cache: unknown,
  routeContext?: RouteContext,
): Promise<NextResponse<InvoicePublicViewResponse>> {
  const shareId = decodeRouteParam((await routeContext?.params)?.shareId ?? '');
  // 200 για κάθε απάντηση της ροής, όπως το `resolve`: η σελίδα διακλαδώνεται στο `reason`.
  const outcome: InvoicePublicViewResponse = shareId === '' || !requestHasShareAccessGrant(request, shareId)
    ? { status: 'refused', reason: 'visit-expired' }
    : await openInvoicePublicView(getAdminFirestore(), { shareId, nowMs: Date.now() });
  return NextResponse.json(outcome, { status: 200, headers: PRIVATE_CHANNEL_HEADERS });
}

export const GET = withStandardRateLimit(
  withAuth<InvoicePublicViewResponse, RouteContext>(handler, { allowUnauthenticated: true }),
);
