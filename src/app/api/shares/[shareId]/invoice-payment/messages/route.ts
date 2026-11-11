import 'server-only';

/**
 * **GET · POST /api/shares/[shareId]/invoice-payment/messages** — «Γράψτε μας» στη σελίδα παραστατικού (ADR-939).
 *
 * Δημόσια (ο πελάτης δεν έχει λογαριασμό): `withAuth` με `allowUnauthenticated` και το **κουπόνι επίσκεψης** του
 * συνδέσμου, όπως η όψη και το checkout. Ο σύνδεσμος ελέγχεται ξανά στον διακομιστή (`readSharedInvoice`).
 *
 * - **GET**: το νήμα (μηνύματα πελάτη + απαντήσεις εκδότη). Όριο ρυθμού STANDARD.
 * - **POST**: νέο μήνυμα. Το σώμα φέρει **μόνο** κείμενο. Ιδεμποτία στο σύνορο (`Idempotency-Key` ανά πάτημα,
 *   CHECK 3.92): η επανάληψη δικτύου αναπαράγει την ίδια απάντηση, δεν γράφει δεύτερο μήνυμα. Όριο ρυθμού SENSITIVE,
 *   επειδή κάθε μήνυμα ειδοποιεί άνθρωπο· από πάνω το ημερήσιο όριο ανά σύνδεσμο.
 *
 * Κεφαλίδες `no-store` + `noindex`, όπως όλες οι απαντήσεις του συνδέσμου.
 *
 * @module api/shares/[shareId]/invoice-payment/messages
 * @see src/server/accounting/public-invoice/invoice-portal-messages.ts
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { PRIVATE_CHANNEL_HEADERS } from '@/lib/http/private-response-headers';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { safeJsonBody } from '@/lib/validation/shared-schemas';
import {
  postInvoicePortalMessage, readInvoicePortalThread,
} from '@/server/accounting/public-invoice/invoice-portal-messages';
import { requestHasShareAccessGrant } from '@/server/sharing/share-access-grant';
import {
  INVOICE_PORTAL_MESSAGE_MAX_LENGTH,
  type InvoicePortalPostResponse,
  type InvoicePortalThreadResponse,
} from '@/subapps/accounting/types/invoice-portal-messages';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ shareId: string }> };

// Όριο στο ωμό σώμα: τα περιθώρια κόβονται στον διακομιστή, που κρίνει και το τελικό μήκος.
const PostBodySchema = z.object({
  text: z.string().max(INVOICE_PORTAL_MESSAGE_MAX_LENGTH * 2),
}).strict();

function respond<T>(outcome: T): NextResponse<T> {
  // 200 για κάθε απάντηση της ροής, όπως το `resolve`: η σελίδα διακλαδώνεται στο `status`/`reason`.
  return NextResponse.json(outcome, { status: 200, headers: PRIVATE_CHANNEL_HEADERS });
}

/** Το `shareId` της διαδρομής — μόνο αν ο browser κρατά το κουπόνι επίσκεψής του. */
async function grantedShareId(request: NextRequest, routeContext?: RouteContext): Promise<string | null> {
  const shareId = decodeRouteParam((await routeContext?.params)?.shareId ?? '');
  return shareId !== '' && requestHasShareAccessGrant(request, shareId) ? shareId : null;
}

async function getHandler(
  request: NextRequest, _ctx: unknown, _cache: unknown, routeContext?: RouteContext,
): Promise<NextResponse<InvoicePortalThreadResponse>> {
  const shareId = await grantedShareId(request, routeContext);
  if (shareId === null) return respond<InvoicePortalThreadResponse>({ status: 'refused', reason: 'visit-expired' });
  return respond(await readInvoicePortalThread(getAdminFirestore(), { shareId, nowMs: Date.now() }));
}

async function postHandler(
  request: NextRequest, _ctx: unknown, _cache: unknown, routeContext?: RouteContext,
): Promise<NextResponse> {
  const shareId = await grantedShareId(request, routeContext);
  if (shareId === null) return respond<InvoicePortalPostResponse>({ status: 'refused', reason: 'visit-expired' });
  const parsed = await safeJsonBody(PostBodySchema, request);
  if (parsed.error) return parsed.error;
  return respond(await postInvoicePortalMessage(getAdminFirestore(), {
    shareId, nowMs: Date.now(), text: parsed.data.text,
  }));
}

export const GET = withStandardRateLimit(
  withAuth<InvoicePortalThreadResponse, RouteContext>(getHandler, { allowUnauthenticated: true }),
);

export const POST = withSensitiveRateLimit(
  withAuth<unknown, RouteContext>(postHandler, { allowUnauthenticated: true }),
);
