import 'server-only';

/**
 * **POST /api/payments/webhooks/[provider]** — συμβάντα του παρόχου πληρωμών (ADR-ACC-030 §5).
 *
 * Σειρά:
 *   1. **Πάροχος ρυθμισμένος;** Όχι ⇒ 503 (ο πάροχος ξαναδοκιμάζει ώσπου να μπουν τα κλειδιά — κανένα συμβάν χαμένο).
 *   2. **Υπογραφή πάνω στο ωμό σώμα** (adapter) — πριν από κάθε ανάλυση· πλαστό ⇒ 401, μηδέν βάση.
 *   3. **Σήμα ⇒ αλήθεια**: η συνεδρία συγχρονίζεται από το API του παρόχου (`handlePaymentSignal`), ποτέ από το payload.
 *   4. Αποτυχία παρόχου / βάσης ⇒ **503**: το σύνορο ιδεμποτίας **δεν** κρατά το 503 και ο πάροχος ξαναδοκιμάζει
 *      (ένα 500 θα αποθηκευόταν και θα αναπαραγόταν για 24 ώρες).
 *   5. Ίχνος παραλαβής (`payment_provider_events`) — αποτύπωμα, σήμα, αποτέλεσμα· ποτέ το σώμα.
 *
 * Ανώνυμο (ο πάροχος δεν έχει ταυτότητα Firebase): `withAuth` με `allowUnauthenticated`. Ιδεμποτία **φυσική**
 * (CHECK 3.92 Κ1): ο πάροχος δεν στέλνει `Idempotency-Key` ούτε event id, και κάθε κίνηση γράφεται με
 * ντετερμινιστικό `paymentId` μέσα σε συναλλαγή — η επανάληψη δίνει `duplicate`.
 *
 * @module api/payments/webhooks/[provider]
 */

import { NextResponse, type NextRequest } from 'next/server';

import type { IdempotencyPolicy } from '@/lib/api/idempotency/idempotency-contract';
import { withAuth } from '@/lib/auth/middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
import { isPaymentProviderId } from '@/lib/payments/payment-routes';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { createModuleLogger } from '@/lib/telemetry';
import { handlePaymentSignal } from '@/server/accounting/payments/payment-webhook-handler';
import type { PaymentProvider, WebhookSignal } from '@/server/payments/payment-provider';
import { recordProviderEventReceipt } from '@/server/payments/payment-provider-event-log';
import { paymentProviderById } from '@/server/payments/payment-provider-registry';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('PaymentWebhookRoute');

type RouteContext = { params: Promise<{ provider: string }> };

type WebhookReply = { readonly received: boolean; readonly error?: string };

/** CHECK 3.92 Κ1 — η απόδειξη ζει στο `recordInvoicePayment` (ντετερμινιστικό `paymentId`, συναλλαγή, `duplicate`). */
const PROVIDER_EVENT_IDEMPOTENCY: IdempotencyPolicy = {
  mode: 'natural',
  why: 'Κάθε κίνηση γράφεται με ντετερμινιστικό paymentId σε συναλλαγή (recordInvoicePayment): το ίδιο συμβάν ξανά ⇒ duplicate.',
};

function reply(status: number, body: WebhookReply): NextResponse<WebhookReply> {
  return NextResponse.json(body, { status });
}

async function processSignal(
  provider: PaymentProvider, signal: WebhookSignal, rawBody: string,
): Promise<NextResponse<WebhookReply>> {
  const db = getAdminFirestore();
  let outcome: string;
  try {
    outcome = await handlePaymentSignal(db, provider, signal);
  } catch (error) {
    logger.error('Payment event could not be applied — provider will retry', {
      provider: provider.id, signal: signal.kind, error: error instanceof Error ? error.message : String(error),
    });
    outcome = 'failed';
  }
  if (outcome !== 'failed') {
    // Η ΜΟΝΗ γραμμή log αποδοχής: χωρίς αυτήν, webhook που πέρασε και συμφιλίωση δεν ξεχωρίζουν στα logs (§5.9 #3).
    logger.info('Payment webhook applied', { provider: provider.id, signal: signal.kind, outcome });
  }
  await recordProviderEventReceipt(db, {
    provider: provider.id, rawBody, signal: signal.kind, outcome, receivedAtMs: Date.now(),
  }).catch((error: unknown) => logger.warn('Provider event receipt not written', {
    error: error instanceof Error ? error.message : String(error),
  }));
  return outcome === 'failed' ? reply(503, { received: false, error: 'retry' }) : reply(200, { received: true });
}

async function handler(
  request: NextRequest, _ctx: unknown, _cache: unknown, routeContext?: RouteContext,
): Promise<NextResponse<WebhookReply>> {
  const providerId = decodeRouteParam((await routeContext?.params)?.provider ?? '');
  if (!isPaymentProviderId(providerId)) return reply(404, { received: false, error: 'unknown-provider' });
  const provider = paymentProviderById(providerId);
  if (provider === null) return reply(503, { received: false, error: 'provider-not-configured' });

  const rawBody = await request.text();
  const verdict = provider.judgeWebhook(rawBody, request.headers);
  if (!verdict.valid) {
    logger.warn('Payment webhook refused', { provider: providerId, reason: verdict.reason });
    return reply(verdict.reason === 'payload-malformed' ? 400 : 401, { received: false, error: verdict.reason });
  }
  return processSignal(provider, verdict.signal, rawBody);
}

export const POST = withWebhookRateLimit(
  withAuth<WebhookReply, RouteContext>(handler, { allowUnauthenticated: true, idempotency: PROVIDER_EVENT_IDEMPOTENCY }),
);
