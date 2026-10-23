/**
 * @fileoverview **«ΝΕΑ ΠΡΟΣΚΛΗΣΗ»** — το γραφείο ξαναστέλνει πρόσκληση σε αγοραστή όταν η προηγούμενη έληξε ή απορρίφθηκε
 *   (ADR-916 §5.17 Φ-Δ.3 · §8 Ο9).
 * @related services/property-handover/property-handover-write.service (ο ΕΝΑΣ γραφέας — supersede στην ίδια συναλλαγή) ·
 *   lib/property-handover/handover-invitation-plan (`handoverInvitationRenewalOf` — η ΙΔΙΑ κρίση με το κουμπί της καρτέλας)
 * @module app/api/properties/[id]/handover/invitation/route
 *
 * 🔑 **Καμία δεύτερη πόρτα έκδοσης**: η πρόθεση ταξιδεύει στη **συμφιλίωση** (`syncPropertyHandovers({renewal})`) και κρίνεται
 *    **μέσα** στη συναλλαγή. ⛔ **Όχι** `mintInvitationLinkReissue` — αρνείται `expired`, και μια άρνηση είναι τερματική
 *    (DocuSign: declined ⇒ νέος φάκελος από τον αποστολέα, ποτέ «ξαναστείλε τον ίδιο»).
 * 🔁 **Ιδεμποτία σε δύο στρώσεις**: το σύνορο `withAuth` αναπαράγει την απάντηση για το **ίδιο** `Idempotency-Key`
 *    (CHECK 3.92)· και ένα δεύτερο POST με **άλλο** κλειδί βρίσκει **ενεργή** πρόσκληση ⇒ `not-renewable`. Ένα email.
 * 🛡️ Δικαίωμα από το `withAuth` (CHECK 3.68) · αποσυρμένο ακίνητο ⇒ 409 (`intent: 'write'`, CHECK 3.100) ·
 *    όριο ρυθμού `SENSITIVE`, χωρίς γραμμή στον πίνακα προθεμάτων (CHECK 3.78 Κ2).
 * 🔒 Η απάντηση **δεν** περιέχει email ούτε token — μόνο έκβαση και λόγο.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { propertyIdOfRequest } from '@/app/api/properties/_shared/property-id-of-request';
import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { syncPropertyHandovers } from '@/services/property-handover/property-handover-write.service';
import {
  HANDOVER_INVITATION_RENEWAL_REFUSED,
  type HandoverInvitationRenewalRefusal,
  type HandoverInvitationRenewalResponse,
} from '@/types/property-handover';

export const dynamic = 'force-dynamic';

/** `confirmDeclined` **ρητό**, χωρίς προεπιλογή: η επιβεβαίωση μετά από άρνηση δεν μαντεύεται ποτέ. */
const RENEWAL_BODY = z.object({
  handoverId: z.string().min(1).max(128),
  confirmDeclined: z.boolean(),
});

/** **Άρνηση → HTTP** — `Record`: νέος λόγος δεν μεταγλωττίζεται χωρίς σημασία στο δίκτυο. */
const RENEWAL_REFUSAL_STATUS: Readonly<Record<HandoverInvitationRenewalRefusal, number>> = {
  'not-renewable': 409,
  'declined-unconfirmed': 409,
  'no-address': 409,
  'awaiting-configuration': 409,
  /** Ξένη ή ανύπαρκτη παράδοση — ίδια απάντηση (καμία πληροφορία ύπαρξης). */
  'handover-unknown': 404,
};

function refused(reason: HandoverInvitationRenewalRefusal): NextResponse<HandoverInvitationRenewalResponse> {
  return NextResponse.json({ error: HANDOVER_INVITATION_RENEWAL_REFUSED, reason } as const, { status: RENEWAL_REFUSAL_STATUS[reason] });
}

async function handlePost(request: NextRequest, ctx: AuthContext): Promise<NextResponse<HandoverInvitationRenewalResponse>> {
  const propertyId = propertyIdOfRequest(request, ctx);
  await requirePropertyInTenantScope({ ctx, propertyId, path: request.nextUrl.pathname, intent: 'write' });
  const parsed = await readJsonBody(request, RENEWAL_BODY);
  if ('rejected' in parsed) return parsed.rejected;

  const outcome = await syncPropertyHandovers(getAdminFirestore(), propertyId, {
    cause: 'office-renewal', performedBy: ctx.uid, renewal: parsed.data,
  });
  // Ο γραφέας ποτέ δεν πετά: `failed` (ήδη στο ημερολόγιο) ή βλάβη έκδοσης ⇒ «δεν μπόρεσα τώρα», ποτέ ονομασμένη άρνηση.
  if (outcome.kind === 'failed' || outcome.renewal?.kind === 'failed') {
    return NextResponse.json({ error: 'RENEWAL_UNAVAILABLE' } as const, { status: 503 });
  }
  const renewal = outcome.renewal ?? { kind: 'refused', reason: 'handover-unknown' } as const;
  return renewal.kind === 'renewed' ? NextResponse.json({ status: 'renewed' } as const) : refused(renewal.reason);
}

export const POST = withSensitiveRateLimit(
  withAuth<HandoverInvitationRenewalResponse>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handlePost(request, ctx),
    { permissions: 'properties:properties:update' },
  ),
);
