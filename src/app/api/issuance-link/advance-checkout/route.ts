/**
 * @fileoverview ADR-943 §5.9 — **η πληρωμή της προκαταβολής** με τον σύνδεσμο που ενέκρινε, χωρίς λογαριασμό.
 * @related server/issuance-invitations/issuance-advance-checkout.ts (η πράξη) · issuance-link-door.ts (η πόρτα)
 *
 * - `POST` · `Authorization: Bearer <σύνδεσμος>` · `{ method, locale, startRequested: true, acknowledgesWithdrawalLoss: true,
 *   accessCode }` → `{ status: 'started', checkoutId, launch }` | `{ status: 'refused', reason }`. Σύνορο ιδεμποτίας ανά
 *   σύνδεσμο (πόρτα, CHECK 3.92): επανάληψη δικτύου ⇒ η **ίδια** συνεδρία. Επιτυχία ⇒ `HttpOnly` cookie επιστροφής στη
 *   σελίδα `/document-request` (χωρίς διαπιστευτήριο — ο σύνδεσμος μένει στο `sessionStorage` της καρτέλας).
 * - `GET ?checkout=pchk_…` → η **έκβαση** της απόπειρας (μόνο της ίδιας ανάθεσης). Καμία εγγραφή ⇒ εκτός ιδεμποτίας.
 * - Το σώμα **δεν** φέρει ποσό· το ρητό αίτημα έναρξης (Κ-6) είναι δύο `true` — αλλιώς 400, καμία πληρωμή.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { DOCUMENT_REQUEST_PATH } from '@/lib/document-validity/document-request-link';
import { issuanceAdvanceCheckoutBody } from '@/lib/document-validity/issuance-request';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { PRIVATE_CHANNEL_HEADERS } from '@/lib/http/private-response-headers';
import { publicOrigin } from '@/lib/http/public-origin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { readIssuanceAdvanceAttempt, startIssuanceAdvanceCheckout } from '@/server/issuance-invitations/issuance-advance-checkout';
import { issuanceLinkFailure, withIssuanceLinkDoor } from '@/server/issuance-invitations/issuance-link-door';
import { setPaymentReturnCookie } from '@/server/payments/payment-return-cookie';
import { INVOICE_CHECKOUT_ATTEMPT_PARAM, PAYMENT_ATTEMPT_ID_PATTERN } from '@/subapps/accounting/types/online-payment';

export const dynamic = 'force-dynamic';

async function checkoutHandler(request: NextRequest, token: string): Promise<NextResponse> {
  const parsed = issuanceAdvanceCheckoutBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return issuanceLinkFailure('answer-mismatch');
  const origin = publicOrigin();
  if (origin === null) return NextResponse.json({ success: true, data: { status: 'refused', reason: 'provider-unavailable' } }, { headers: PRIVATE_CHANNEL_HEADERS });
  const outcome = await startIssuanceAdvanceCheckout(getAdminFirestore(), token, { body: parsed.data, origin, now: new Date() });
  if (outcome.kind === 'unavailable') return issuanceLinkFailure('unavailable');
  if (outcome.kind === 'refused') return issuanceLinkFailure(outcome.reason, outcome.remaining);
  const response = NextResponse.json({ success: true, data: outcome.result }, { headers: PRIVATE_CHANNEL_HEADERS });
  if (outcome.result.status === 'started') setPaymentReturnCookie(response, DOCUMENT_REQUEST_PATH);
  return response;
}

async function attemptHandler(request: NextRequest, token: string): Promise<NextResponse> {
  const checkoutId = request.nextUrl.searchParams.get(INVOICE_CHECKOUT_ATTEMPT_PARAM) ?? '';
  if (!PAYMENT_ATTEMPT_ID_PATTERN.test(checkoutId)) {
    return NextResponse.json({ success: true, data: { status: 'refused', reason: 'unknown-attempt' } }, { headers: PRIVATE_CHANNEL_HEADERS });
  }
  const outcome = await readIssuanceAdvanceAttempt(getAdminFirestore(), token, checkoutId, new Date());
  if ('kind' in outcome) return outcome.kind === 'unavailable' ? issuanceLinkFailure('unavailable') : issuanceLinkFailure(outcome.reason);
  return NextResponse.json({ success: true, data: outcome }, { headers: PRIVATE_CHANNEL_HEADERS });
}

export const POST = withHeavyRateLimit(withIssuanceLinkDoor({}, checkoutHandler));
export const GET = withHeavyRateLimit(withIssuanceLinkDoor({}, attemptHandler));
