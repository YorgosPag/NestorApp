/**
 * @fileoverview **«ΑΝΑΚΛΗΣΗ ΠΑΡΑΔΟΣΗΣ»** — το γραφείο ανακαλεί μια ολοκληρωμένη παράδοση της οποίας η πώληση δεν ισχύει πια
 *   (ADR-916 §5.19 Φ-Δ.5 · Δ8 · Ο4).
 * @related services/property-handover/property-handover-write.service (ο ΕΝΑΣ γραφέας — `withdrawal`) ·
 *   lib/property-handover/handover-withdrawal-plan (`handoverWithdrawalOf` — η ΙΔΙΑ κρίση με το κουμπί της καρτέλας)
 * @module app/api/properties/[id]/handover/withdrawal/route
 *
 * 🔁 **Ιδεμποτία σε δύο στρώσεις**: το σύνορο `withAuth` αναπαράγει την απάντηση για το **ίδιο** `Idempotency-Key`
 *    (CHECK 3.92)· και μια επανάληψη με **άλλο** κλειδί βρίσκει την παράδοση ήδη ανακλημένη ⇒ `unchanged` (κανένα δεύτερο email).
 * ⚠️ **Μη αναστρέψιμη** (DocuSign void): η επιβεβαίωση είναι **ρητή** στο σώμα (`confirmIrreversible: true`) — δεν μαντεύεται.
 * 🛡️ Δικαίωμα από το `withAuth` (CHECK 3.68) · αποσυρμένο ακίνητο ⇒ 409 (`intent: 'write'`, CHECK 3.100) ·
 *    όριο ρυθμού `SENSITIVE`, χωρίς γραμμή στον πίνακα προθεμάτων (CHECK 3.78 Κ2).
 * 🔒 Η απάντηση **δεν** περιέχει αιτιολογία ούτε uid — μόνο έκβαση και λόγο.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { propertyIdOfRequest } from '@/app/api/properties/_shared/property-id-of-request';
import { HANDOVER_OFFICE_REASON_MAX, HANDOVER_OFFICE_REASON_MIN } from '@/config/property-handover-office-policy';
import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { syncPropertyHandovers } from '@/services/property-handover/property-handover-write.service';
import {
  HANDOVER_WITHDRAWAL_REFUSED,
  type HandoverWithdrawalRefusal,
  type HandoverWithdrawalResponse,
} from '@/types/property-handover';

export const dynamic = 'force-dynamic';

/** Όλα **ρητά**: η αιτιολογία είναι υποχρεωτική και η επιβεβαίωση του μη αναστρέψιμου είναι `true`, ποτέ προεπιλογή. */
const WITHDRAWAL_BODY = z.object({
  handoverId: z.string().min(1).max(128),
  reason: z.string().trim().min(HANDOVER_OFFICE_REASON_MIN).max(HANDOVER_OFFICE_REASON_MAX),
  confirmIrreversible: z.literal(true),
});

/** **Άρνηση → HTTP** — `Record`: νέος λόγος δεν μεταγλωττίζεται χωρίς σημασία στο δίκτυο. */
const WITHDRAWAL_REFUSAL_STATUS: Readonly<Record<HandoverWithdrawalRefusal, number>> = {
  'not-withdrawable': 409,
  /** Ξένη ή ανύπαρκτη παράδοση — ίδια απάντηση (καμία πληροφορία ύπαρξης). */
  'handover-unknown': 404,
};

function refused(reason: HandoverWithdrawalRefusal): NextResponse<HandoverWithdrawalResponse> {
  return NextResponse.json({ error: HANDOVER_WITHDRAWAL_REFUSED, reason } as const, { status: WITHDRAWAL_REFUSAL_STATUS[reason] });
}

async function handlePost(request: NextRequest, ctx: AuthContext): Promise<NextResponse<HandoverWithdrawalResponse>> {
  const propertyId = propertyIdOfRequest(request, ctx);
  await requirePropertyInTenantScope({ ctx, propertyId, path: request.nextUrl.pathname, intent: 'write' });
  const parsed = await readJsonBody(request, WITHDRAWAL_BODY);
  if ('rejected' in parsed) return parsed.rejected;

  const { handoverId, reason } = parsed.data;
  const outcome = await syncPropertyHandovers(getAdminFirestore(), propertyId, {
    cause: 'office-withdrawal', performedBy: ctx.uid, withdrawal: { handoverId, reason },
  });
  // Ο γραφέας ποτέ δεν πετά: `failed` (ήδη στο ημερολόγιο) ⇒ «δεν μπόρεσα τώρα», ποτέ ονομασμένη άρνηση.
  if (outcome.kind === 'failed') return NextResponse.json({ error: 'WITHDRAWAL_UNAVAILABLE' } as const, { status: 503 });
  const withdrawal = outcome.withdrawal ?? { kind: 'refused', reason: 'handover-unknown' } as const;
  return withdrawal.kind === 'refused' ? refused(withdrawal.reason) : NextResponse.json({ status: withdrawal.kind });
}

export const POST = withSensitiveRateLimit(
  withAuth<HandoverWithdrawalResponse>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handlePost(request, ctx),
    { permissions: 'properties:properties:update' },
  ),
);
