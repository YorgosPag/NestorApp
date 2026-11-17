import 'server-only';

/**
 * @fileoverview ADR-943 §5.9 · §5.14 — **«Λήψη πληρωμών»** του ίδιου του χρήστη (ο μηχανικός ως δικαιούχος marketplace).
 * @related server/payments/payment-payee-service.ts (`readPayoutAccount` · `registerPayoutAccount` · `updatePayoutAccount`)
 *   · lib/payments/payout-account.ts
 *
 * - `GET` → `PayoutAccountView`: κατάσταση από την εγγραφή + εξουσιοδότηση και δηλωμένα στοιχεία **από τον πάροχο**
 *   (το IBAN μόνο μασκαρισμένο).
 * - `POST` · στοιχεία εγγραφής → `PayoutAccountView`. Ιδεμποτική εκ κατασκευής (ΕΝΑΣ δικαιούχος ανά χρήστη,
 *   ντετερμινιστική ταυτότητα + κράτηση θέσης) **και** στο σύνορο (`Idempotency-Key`).
 * - `PATCH` · αλλαγή στοιχείων → `PayoutAccountView`. Μόνο με **πρόσφατη** σύνδεση (`auth_time` του Bearer token,
 *   «sudo mode»)· αλλιώς `403 reauthentication-required` και ο πελάτης ζητά επιβεβαίωση ταυτότητας.
 * ⚠️ Κανένα `uid` στο σώμα: η ταυτότητα και το email είναι του token. IBAN/ΑΦΜ **δεν** αποθηκεύονται — περνούν στον PSP.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  PAYOUT_REAUTHENTICATION_REQUIRED,
  payoutRegistrationSchema,
  payoutUpdateSchema,
  type PayoutAccountView,
} from '@/lib/payments/payout-account';
import { readPayoutAccount, registerPayoutAccount, updatePayoutAccount } from '@/server/payments/payment-payee-service';
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

async function updateHandler(request: NextRequest, actor: ApiActor): Promise<NextResponse> {
  const parsed = await readJsonBody(request, payoutUpdateSchema);
  if ('rejected' in parsed) return parsed.rejected;
  const outcome = await updatePayoutAccount(
    getAdminFirestore(), marketplacePaymentProvider(),
    { userId: actor.ctx.uid, authTimeSec: actor.ctx.authTimeSec }, parsed.data, Date.now(),
  );
  switch (outcome.kind) {
    case 'updated': return NextResponse.json(outcome.view);
    case 'reauthentication-required': return NextResponse.json({ error: PAYOUT_REAUTHENTICATION_REQUIRED }, { status: 403 });
    case 'not-registered': return NextResponse.json({ error: 'not-registered' }, { status: 409 });
  }
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth<PayoutAccountView>(readHandler));
export const POST = withStandardRateLimit(withPersonalOrOrgAuth(registerHandler));
export const PATCH = withSensitiveRateLimit(withPersonalOrOrgAuth(updateHandler));
