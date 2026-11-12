import 'server-only';

/**
 * **GET|POST /api/payments/return/[provider]?checkout=<id>** — ο browser επιστρέφει από τον πάροχο (ADR-ACC-030 §5).
 *
 * **Δεν καταγράφει ποτέ χρήματα.** Η καταγραφή της πληρωμής ανήκει στο webhook (εγγυημένο από τον πάροχο για τις
 * επιτυχίες) και στη συμφιλίωση· η επιστροφή μπορεί να μην έρθει ποτέ (ο πελάτης κλείνει την καρτέλα) ή να έρθει
 * δύο φορές (ανανέωση). Εδώ μόνο:
 *   1. ανακατεύθυνση **303** στη σελίδα του συνδέσμου (από το `HttpOnly` cookie που γράφτηκε στην έναρξη) με
 *      `?payment=<checkoutId>`, ώστε η σελίδα να ρωτήσει την έκβαση της απόπειρας και να περιμένει·
 *   2. όταν ο πάροχος στέλνει υπογραφή (IRIS: `hash`), κρίνεται· η απόφαση «πληρώθηκε» δεν παίρνεται ποτέ εδώ.
 *   3. **Αρνημένη απόπειρα** με έγκυρη υπογραφή (ADR-ACC-030 §5.4): `lastFailure` στη συνεδρία — ο ΙΔΙΟΣ δρόμος με
 *      το webhook (`notePaymentAttemptFailure`), επειδή ο πάροχος **δεν** εγγυάται webhook σε αποτυχία. Μόνο όταν η
 *      υπογεγραμμένη συνεδρία είναι **η ίδια** με το `?checkout=` της δικής μας διεύθυνσης. Καμία κατάσταση, κανένα
 *      ποσό· σφάλμα εγγραφής δεν εμποδίζει την επιστροφή.
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
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { notePaymentAttemptFailure } from '@/server/accounting/payments/payment-webhook-handler';
import { webhookSignalDiagnostics, type PaymentProvider, type WebhookSignal } from '@/server/payments/payment-provider';
import { paymentProviderById } from '@/server/payments/payment-provider-registry';
import { PAYMENT_ATTEMPT_ID_PATTERN, PAYMENT_PAGE_ATTEMPT_PARAM } from '@/subapps/accounting/types/online-payment';
import { readPaymentReturnPath } from '@/server/payments/payment-return-cookie';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('PaymentReturnRoute');

type RouteContext = { params: Promise<{ provider: string }> };

/** CHECK 3.92 Κ1 — η μόνη εγγραφή (`lastFailure`) είναι ιδεμποτική εκ κατασκευής: ίδια αποτυχία ξανά ⇒ `unchanged`. */
const RETURN_IDEMPOTENCY: IdempotencyPolicy = {
  mode: 'natural',
  why: 'Χωρίς χρήματα: μόνο lastFailure σε pending συνεδρία, σε συναλλαγή — ίδια αποτυχία ξανά ⇒ unchanged (recordCheckoutFailure).',
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

/** Υπογεγραμμένη αρνημένη απόπειρα ⇒ `lastFailure` (μόνο για τη συνεδρία της δικής μας διεύθυνσης). */
async function noteReturnedFailure(provider: PaymentProvider, signal: WebhookSignal, checkoutId: string): Promise<string> {
  if (signal.kind !== 'authorization-failed') return 'none';
  if (signal.checkoutId === null) return 'checkout-unsigned';
  if (signal.checkoutId !== checkoutId) return 'checkout-mismatch';
  try {
    return await notePaymentAttemptFailure(getAdminFirestore(), provider, signal, nowISO());
  } catch (error) {
    logger.warn('Returned payment failure not noted — the webhook may still note it', {
      provider: provider.id, checkoutId, error: error instanceof Error ? error.message : String(error),
    });
    return 'error';
  }
}

async function noteProviderVerdict(request: NextRequest, providerId: string, checkoutId: string): Promise<void> {
  const provider = isPaymentProviderId(providerId) ? paymentProviderById(providerId) : null;
  const fields = await providerFieldsOf(request);
  if (provider === null || !fields.has('hash')) return;
  const verdict = provider.judgeReturn(fields);
  if (!verdict.valid) {
    logger.info('Browser returned from payment provider', {
      provider: providerId, checkoutId, signal: `refused:${verdict.reason}`,
    });
    return;
  }
  const failure = await noteReturnedFailure(provider, verdict.signal, checkoutId);
  logger.info('Browser returned from payment provider', {
    provider: providerId, checkoutId, ...webhookSignalDiagnostics(verdict), failure,
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
  const query = PAYMENT_ATTEMPT_ID_PATTERN.test(checkoutId)
    ? `?${new URLSearchParams({ [PAYMENT_PAGE_ATTEMPT_PARAM]: checkoutId }).toString()}`
    : '';
  return redirectTo(`${returnPath}${query}`, 303);
}

const route = withWebhookRateLimit(withAuth<unknown, RouteContext>(handler, { allowUnauthenticated: true, idempotency: RETURN_IDEMPOTENCY }));

export const GET = route;
export const POST = route;
