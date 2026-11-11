import 'server-only';

/**
 * **GET|POST /api/payments/return/[provider]?checkout=<id>** — ο browser επιστρέφει από τον πάροχο (ADR-ACC-030 §5).
 *
 * **Δεν γράφει τίποτα.** Η καταγραφή της πληρωμής ανήκει στο webhook (εγγυημένο από τον πάροχο) και στη
 * συμφιλίωση· η επιστροφή μπορεί να μην έρθει ποτέ (ο πελάτης κλείνει την καρτέλα) ή να έρθει δύο φορές
 * (ανανέωση). Εδώ μόνο:
 *   1. ανακατεύθυνση **303** στη σελίδα του συνδέσμου (από το `HttpOnly` cookie που γράφτηκε στην έναρξη) με
 *      `?payment=<checkoutId>`, ώστε η σελίδα να δείξει «η πληρωμή καταχωρείται» και να περιμένει·
 *   2. όταν ο πάροχος στέλνει υπογραφή (IRIS: `hash`), κρίνεται και καταγράφεται μόνο ως διάγνωση — η απόφαση
 *      «πληρώθηκε» δεν παίρνεται ποτέ από τον browser.
 *
 * Χωρίς cookie (άλλος browser / έληξε) ⇒ η αρχική σελίδα· ο πελάτης ανοίγει ξανά τον σύνδεσμο από το email.
 *
 * @module api/payments/return/[provider]
 */

import type { NextRequest, NextResponse } from 'next/server';

import type { IdempotencyPolicy } from '@/lib/api/idempotency/idempotency-contract';
import { withAuth } from '@/lib/auth/middleware';
import { redirectTo } from '@/lib/http/request-origin';
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
import { isPaymentProviderId, PAYMENT_RETURN_CHECKOUT_PARAM } from '@/lib/payments/payment-routes';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { createModuleLogger } from '@/lib/telemetry';
import { paymentProviderById } from '@/server/payments/payment-provider-registry';
import { readPaymentReturnPath } from '@/server/payments/payment-return-cookie';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('PaymentReturnRoute');

type RouteContext = { params: Promise<{ provider: string }> };

/** CHECK 3.92 Κ1 — η διαδρομή δεν γράφει σε καμία αποθήκη: μόνο κρίνει και ανακατευθύνει. */
const RETURN_IDEMPOTENCY: IdempotencyPolicy = {
  mode: 'natural',
  why: 'Καμία εγγραφή: η επιστροφή του browser μόνο ανακατευθύνει (303) — την πληρωμή την καταγράφει το webhook.',
};

/** Τα πεδία του παρόχου: query (GET) ή φόρμα (POST, IRIS callback). */
async function providerFieldsOf(request: NextRequest): Promise<URLSearchParams> {
  if (request.method !== 'POST') return request.nextUrl.searchParams;
  try {
    return new URLSearchParams(await request.text());
  } catch {
    return new URLSearchParams();
  }
}

async function noteProviderVerdict(request: NextRequest, providerId: string, checkoutId: string): Promise<void> {
  const provider = isPaymentProviderId(providerId) ? paymentProviderById(providerId) : null;
  const fields = await providerFieldsOf(request);
  if (provider === null || !fields.has('hash')) return;
  const verdict = provider.judgeReturn(fields);
  logger.info('Browser returned from payment provider', {
    provider: providerId, checkoutId, signal: verdict.valid ? verdict.signal.kind : `refused:${verdict.reason}`,
  });
}

async function handler(
  request: NextRequest, _ctx: unknown, _cache: unknown, routeContext?: RouteContext,
): Promise<NextResponse> {
  const providerId = decodeRouteParam((await routeContext?.params)?.provider ?? '');
  const checkoutId = request.nextUrl.searchParams.get(PAYMENT_RETURN_CHECKOUT_PARAM) ?? '';
  await noteProviderVerdict(request, providerId, checkoutId);
  const returnPath = readPaymentReturnPath(request);
  if (returnPath === null) return redirectTo('/', 303);
  // Σχετικό `Location` (ποτέ `request.url`: πίσω από τον proxy είναι το εσωτερικό host — `lib/http/request-origin`).
  const query = /^pchk_[A-Za-z0-9-]+$/.test(checkoutId) ? `?${new URLSearchParams({ payment: checkoutId }).toString()}` : '';
  return redirectTo(`${returnPath}${query}`, 303);
}

const route = withWebhookRateLimit(withAuth<unknown, RouteContext>(handler, { allowUnauthenticated: true, idempotency: RETURN_IDEMPOTENCY }));

export const GET = route;
export const POST = route;
