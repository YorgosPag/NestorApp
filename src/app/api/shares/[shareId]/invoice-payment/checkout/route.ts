import 'server-only';

/**
 * **POST /api/shares/[shareId]/invoice-payment/checkout** — ο κάτοχος του συνδέσμου ξεκινά online πληρωμή
 * (κάρτα / Apple Pay / Google Pay · IRIS) — ADR-ACC-030 §5.
 * **GET …/checkout?checkout=pchk_…** — η **έκβαση** αυτής της απόπειρας (`pending` · `failed` · `paid` · `closed`,
 * ADR-ACC-030 §5.6): τίποτα πέρα από αυτό, και μόνο για απόπειρα του **ίδιου** συνδέσμου. GET χωρίς εγγραφή ⇒ εκτός
 * ιδεμποτίας (CHECK 3.92). Ίδιο κουπόνι επίσκεψης, ίδιο όριο STANDARD με την όψη.
 *
 * Δημόσια (ο πελάτης δεν έχει λογαριασμό): `withAuth` με `allowUnauthenticated` και το **κουπόνι επίσκεψης** του
 * συνδέσμου, όπως η όψη. Το σώμα φέρει **μόνο** τρόπο, γλώσσα και τη διαδρομή της σελίδας — ποτέ ποσό.
 *
 * Ιδεμποτία: εξ ορισμού στο σύνορο (`Idempotency-Key` από τη σελίδα, ένα ανά πάτημα) — η επανάληψη δικτύου
 * επιστρέφει την **ίδια** συνεδρία. Όριο ρυθμού STANDARD, όπως το υπόλοιπο `/api/shares`.
 *
 * Επιτυχία ⇒ `HttpOnly` cookie επιστροφής (`payment-return-cookie`): ο browser θυμάται τη σελίδα του συνδέσμου
 * χωρίς το token να φτάσει στον πάροχο.
 *
 * @module api/shares/[shareId]/invoice-payment/checkout
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { PRIVATE_CHANNEL_HEADERS } from '@/lib/http/private-response-headers';
import { publicOrigin } from '@/lib/http/public-origin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { safeJsonBody } from '@/lib/validation/shared-schemas';
import { readInvoicePaymentAttempt } from '@/server/accounting/payments/invoice-payment-attempt';
import { startInvoicePaymentCheckout } from '@/server/accounting/payments/invoice-payment-checkout';
import { isPaymentReturnPath, setPaymentReturnCookie } from '@/server/payments/payment-return-cookie';
import { requestHasShareAccessGrant } from '@/server/sharing/share-access-grant';
import {
  INVOICE_CHECKOUT_ATTEMPT_PARAM,
  ONLINE_PAYMENT_METHODS,
  PAYMENT_ATTEMPT_ID_PATTERN,
  type InvoiceCheckoutAttemptResponse,
  type InvoiceCheckoutResponse,
} from '@/subapps/accounting/types/online-payment';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ shareId: string }> };

const CheckoutBodySchema = z.object({
  method: z.enum(ONLINE_PAYMENT_METHODS),
  locale: z.enum(['el', 'en']),
  returnPath: z.string().max(512).refine(isPaymentReturnPath),
}).strict();

function respond(outcome: InvoiceCheckoutResponse): NextResponse<InvoiceCheckoutResponse> {
  return NextResponse.json(outcome, { status: 200, headers: PRIVATE_CHANNEL_HEADERS });
}

async function handler(
  request: NextRequest, _ctx: unknown, _cache: unknown, routeContext?: RouteContext,
): Promise<NextResponse> {
  const shareId = decodeRouteParam((await routeContext?.params)?.shareId ?? '');
  if (shareId === '' || !requestHasShareAccessGrant(request, shareId)) {
    return respond({ status: 'refused', reason: 'visit-expired' });
  }
  const parsed = await safeJsonBody(CheckoutBodySchema, request);
  if (parsed.error) return parsed.error;
  const origin = publicOrigin();
  if (origin === null) return respond({ status: 'refused', reason: 'provider-unavailable' });

  const outcome = await startInvoicePaymentCheckout(getAdminFirestore(), {
    ...parsed.data, shareId, origin, nowMs: Date.now(),
  });
  const response = respond(outcome);
  if (outcome.status === 'started') setPaymentReturnCookie(response, parsed.data.returnPath);
  return response;
}

async function attemptHandler(
  request: NextRequest, _ctx: unknown, _cache: unknown, routeContext?: RouteContext,
): Promise<NextResponse<InvoiceCheckoutAttemptResponse>> {
  const shareId = decodeRouteParam((await routeContext?.params)?.shareId ?? '');
  const checkoutId = request.nextUrl.searchParams.get(INVOICE_CHECKOUT_ATTEMPT_PARAM) ?? '';
  // 200 για κάθε απάντηση της ροής, όπως η όψη: η σελίδα διακλαδώνεται στο `reason`.
  const outcome: InvoiceCheckoutAttemptResponse = shareId === '' || !requestHasShareAccessGrant(request, shareId)
    ? { status: 'refused', reason: 'visit-expired' }
    : !PAYMENT_ATTEMPT_ID_PATTERN.test(checkoutId)
      ? { status: 'refused', reason: 'unknown-attempt' }
      : await readInvoicePaymentAttempt(getAdminFirestore(), { shareId, checkoutId, nowMs: Date.now() });
  return NextResponse.json(outcome, { status: 200, headers: PRIVATE_CHANNEL_HEADERS });
}

export const POST = withStandardRateLimit(withAuth<unknown, RouteContext>(handler, { allowUnauthenticated: true }));

export const GET = withStandardRateLimit(
  withAuth<InvoiceCheckoutAttemptResponse, RouteContext>(attemptHandler, { allowUnauthenticated: true }),
);
