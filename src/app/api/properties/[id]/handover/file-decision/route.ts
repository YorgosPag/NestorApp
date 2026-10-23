/**
 * @fileoverview **«ΑΠΟΦΑΣΗ ΓΙΑ ΑΡΧΕΙΟ»** — το γραφείο ορίζει αν ένα αρχείο της πώλησης παραδίδεται στον αγοραστή ή μένει
 *   εσωτερικό, με υποχρεωτική αιτιολογία (ADR-916 §5.18 Φ-Δ.4).
 * @related services/property-handover/property-handover-file-decision.service (ο ΕΝΑΣ γραφέας) ·
 *   lib/property-handover/handover-file-decision-plan (`handoverFileDecisionOf` — η ΙΔΙΑ κρίση με τον διάλογο της καρτέλας)
 * @module app/api/properties/[id]/handover/file-decision/route
 *
 * 🔁 **Ιδεμποτία σε δύο στρώσεις**: το σύνορο `withAuth` αναπαράγει την απάντηση για το **ίδιο** `Idempotency-Key`
 *    (CHECK 3.92)· και μια επανάληψη με **άλλο** κλειδί βρίσκει την απόφαση ήδη να ισχύει ⇒ `unchanged`.
 * 🛡️ Δικαίωμα από το `withAuth` (CHECK 3.68) · αποσυρμένο ακίνητο ⇒ 409 (`intent: 'write'`, CHECK 3.100) ·
 *    όριο ρυθμού `SENSITIVE`, χωρίς γραμμή στον πίνακα προθεμάτων (CHECK 3.78 Κ2).
 * 🔒 Η απάντηση **δεν** περιέχει αιτιολογία ούτε uid — μόνο έκβαση και λόγο.
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
import { decideHandoverFile } from '@/services/property-handover/property-handover-file-decision.service';
import {
  HANDOVER_FILE_DECISION_CHOICES,
  HANDOVER_FILE_DECISION_DISPOSITIONS,
  HANDOVER_FILE_DECISION_REASON_MAX,
  HANDOVER_FILE_DECISION_REASON_MIN,
  HANDOVER_FILE_DECISION_REFUSED,
  type HandoverFileDecisionRefusal,
  type HandoverFileDecisionResponse,
} from '@/types/property-handover-file-decision';

export const dynamic = 'force-dynamic';

/** Όλα **ρητά**, χωρίς προεπιλογές: ούτε η επιβεβαίωση εμπιστευτικού ούτε η «αναμενόμενη» απόφαση μαντεύονται. */
const DECISION_BODY = z.object({
  fileId: z.string().min(1).max(128),
  choice: z.enum(HANDOVER_FILE_DECISION_CHOICES),
  expected: z.enum(HANDOVER_FILE_DECISION_DISPOSITIONS).nullable(),
  reason: z.string().trim().min(HANDOVER_FILE_DECISION_REASON_MIN).max(HANDOVER_FILE_DECISION_REASON_MAX),
  confirmConfidential: z.boolean(),
});

/** **Άρνηση → HTTP** — `Record`: νέος λόγος δεν μεταγλωττίζεται χωρίς σημασία στο δίκτυο. */
const DECISION_REFUSAL_STATUS: Readonly<Record<HandoverFileDecisionRefusal, number>> = {
  /** Ξένο, ανύπαρκτο ή εκτός πώλησης αρχείο — ίδια απάντηση (καμία πληροφορία ύπαρξης). */
  'file-unknown': 404,
  'protocol-file': 409,
  unrecognised: 409,
  stale: 409,
  'already-delivered': 409,
  'confidential-unconfirmed': 409,
};

function refused(reason: HandoverFileDecisionRefusal): NextResponse<HandoverFileDecisionResponse> {
  return NextResponse.json({ error: HANDOVER_FILE_DECISION_REFUSED, reason } as const, { status: DECISION_REFUSAL_STATUS[reason] });
}

async function handlePost(request: NextRequest, ctx: AuthContext): Promise<NextResponse<HandoverFileDecisionResponse>> {
  const propertyId = propertyIdOfRequest(request, ctx);
  await requirePropertyInTenantScope({ ctx, propertyId, path: request.nextUrl.pathname, intent: 'write' });
  const parsed = await readJsonBody(request, DECISION_BODY);
  if ('rejected' in parsed) return parsed.rejected;

  const outcome = await decideHandoverFile(getAdminFirestore(), {
    ...parsed.data, companyId: ctx.companyId, propertyId, performedBy: ctx.uid,
  });
  // Ο γραφέας ποτέ δεν πετά: `failed` (ήδη στο ημερολόγιο) ⇒ «δεν μπόρεσα τώρα», ποτέ ονομασμένη άρνηση.
  if (outcome.kind === 'failed') return NextResponse.json({ error: 'FILE_DECISION_UNAVAILABLE' } as const, { status: 503 });
  return outcome.kind === 'refused' ? refused(outcome.reason) : NextResponse.json({ status: outcome.kind });
}

export const POST = withSensitiveRateLimit(
  withAuth<HandoverFileDecisionResponse>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handlePost(request, ctx),
    { permissions: 'properties:properties:update' },
  ),
);
