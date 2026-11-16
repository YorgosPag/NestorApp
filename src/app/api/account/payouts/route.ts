import 'server-only';

/**
 * @fileoverview ADR-943 §5.9 — **«Λήψη πληρωμών»** του ίδιου του χρήστη (ο μηχανικός ως δικαιούχος marketplace).
 * @related server/payments/payment-payee-service.ts (`readPayoutAccount` · `registerPayoutAccount`) · lib/payments/payout-account.ts
 *
 * - `GET` → `PayoutAccountView` (από την εγγραφή — καμία κλήση στον πάροχο).
 * - `POST` · στοιχεία εγγραφής → `PayoutAccountView` με τη hosted σελίδα KYC του παρόχου. Ιδεμποτική εκ κατασκευής
 *   (ΕΝΑΣ δικαιούχος ανά χρήστη, ντετερμινιστική ταυτότητα + κράτηση θέσης) **και** στο σύνορο (`Idempotency-Key`).
 * ⚠️ Κανένα `uid` στο σώμα: η ταυτότητα και το email είναι του token. IBAN/ΑΦΜ **δεν** αποθηκεύονται — περνούν στον PSP.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { payoutRegistrationSchema, type PayoutAccountView } from '@/lib/payments/payout-account';
import { readPayoutAccount, registerPayoutAccount } from '@/server/payments/payment-payee-service';
import { marketplacePaymentProvider } from '@/server/payments/payment-provider-registry';

async function readHandler(_request: NextRequest, actor: ApiActor): Promise<NextResponse<PayoutAccountView>> {
  return NextResponse.json(await readPayoutAccount(getAdminFirestore(), marketplacePaymentProvider(), actor.ctx.uid));
}

async function registerHandler(request: NextRequest, actor: ApiActor): Promise<NextResponse> {
  const parsed = await readJsonBody(request, payoutRegistrationSchema);
  if ('rejected' in parsed) return parsed.rejected;
  const view = await registerPayoutAccount(
    getAdminFirestore(), marketplacePaymentProvider(), { userId: actor.ctx.uid, email: actor.ctx.email }, parsed.data,
  );
  return NextResponse.json(view);
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth<PayoutAccountView>(readHandler));
export const POST = withStandardRateLimit(withPersonalOrOrgAuth(registerHandler));
