/**
 * @fileoverview **«ΚΛΕΙΣΙΜΟ ΓΡΑΜΜΗΣ ΧΩΡΙΣ ΠΛΗΡΕΣ ΑΠΟΤΥΠΩΜΑ»** — το γραφείο κλείνει μια γραμμή παράδοσης της οποίας τα bytes
 *   χάθηκαν οριστικά πριν μετρηθεί το sha256 (ADR-916 §5.23 Φ-Δ.7γ · Ο13β (i)).
 * @related services/property-handover/property-handover-line-closure.service (η πόρτα) ·
 *   lib/property-handover/handover-line-closure (`handoverLineClosureOf` — η ΙΔΙΑ κρίση με το κουμπί της καρτέλας)
 * @module app/api/properties/[id]/handover/line-closure/route
 *
 * 🔁 **Ιδεμποτία σε δύο στρώσεις**: το σύνορο `withAuth` αναπαράγει την απάντηση για το **ίδιο** `Idempotency-Key`
 *    (CHECK 3.92)· και μια επανάληψη με **άλλο** κλειδί βρίσκει τη γραμμή ήδη κλεισμένη ⇒ `unchanged`.
 * ⚠️ **Μη αναστρέψιμο** (DocuSign void): η επιβεβαίωση είναι **ρητή** στο σώμα (`confirmIrreversible: true`). Η **αιτία**
 *    δεν είναι πεδίο του σώματος — τη μετρά η μηχανή.
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
import { closeHandoverLine } from '@/services/property-handover/property-handover-line-closure.service';
import {
  HANDOVER_LINE_CLOSURE_REFUSED,
  type HandoverLineClosureRefusal,
  type HandoverLineClosureResponse,
} from '@/types/property-handover-line-closure';

export const dynamic = 'force-dynamic';

/** Όλα **ρητά**: η αιτιολογία είναι υποχρεωτική και η επιβεβαίωση του μη αναστρέψιμου είναι `true`, ποτέ προεπιλογή. */
const LINE_CLOSURE_BODY = z.object({
  handoverId: z.string().min(1).max(128),
  sourceFileId: z.string().min(1).max(128),
  reason: z.string().trim().min(HANDOVER_OFFICE_REASON_MIN).max(HANDOVER_OFFICE_REASON_MAX),
  confirmIrreversible: z.literal(true),
});

/** **Άρνηση → HTTP** — `Record`: νέος λόγος δεν μεταγλωττίζεται χωρίς σημασία στο δίκτυο. */
const LINE_CLOSURE_REFUSAL_STATUS: Readonly<Record<HandoverLineClosureRefusal, number>> = {
  /** Ξένη ή ανύπαρκτη παράδοση/γραμμή — ίδια απάντηση (καμία πληροφορία ύπαρξης). */
  'line-unknown': 404,
  'not-owed': 409,
  proven: 409,
  closed: 409,
  provable: 409,
  recovering: 409,
};

function refused(reason: HandoverLineClosureRefusal): NextResponse<HandoverLineClosureResponse> {
  return NextResponse.json({ error: HANDOVER_LINE_CLOSURE_REFUSED, reason } as const, { status: LINE_CLOSURE_REFUSAL_STATUS[reason] });
}

async function handlePost(request: NextRequest, ctx: AuthContext): Promise<NextResponse<HandoverLineClosureResponse>> {
  const propertyId = propertyIdOfRequest(request, ctx);
  await requirePropertyInTenantScope({ ctx, propertyId, path: request.nextUrl.pathname, intent: 'write' });
  const parsed = await readJsonBody(request, LINE_CLOSURE_BODY);
  if ('rejected' in parsed) return parsed.rejected;

  const { handoverId, sourceFileId, reason } = parsed.data;
  const outcome = await closeHandoverLine(getAdminFirestore(), {
    companyId: ctx.companyId, propertyId, handoverId, sourceFileId, reason, performedBy: ctx.uid,
  });
  // Η πόρτα ποτέ δεν πετά: `failed` (ήδη στο ημερολόγιο) ⇒ «δεν μπόρεσα τώρα», ποτέ ονομασμένη άρνηση.
  if (outcome.kind === 'failed') return NextResponse.json({ error: 'LINE_CLOSURE_UNAVAILABLE' } as const, { status: 503 });
  return outcome.kind === 'refused' ? refused(outcome.reason) : NextResponse.json({ status: outcome.kind });
}

export const POST = withSensitiveRateLimit(
  withAuth<HandoverLineClosureResponse>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handlePost(request, ctx),
    { permissions: 'properties:properties:update' },
  ),
);
