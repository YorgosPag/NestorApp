/**
 * @fileoverview `POST /api/document-registry/issuance-assignments/advance-link` — **«Αίτημα πληρωμής / Νέος σύνδεσμος»** της
 *   προκαταβολής προς τον ιδιοκτήτη (ADR-943 Φ5β2 · §8 #11, πρότυπο Stripe «Send invoice»).
 * @related server/issuance-invitations/issuance-advance-payment-request.ts (η πράξη) · ../space-invitation/route.ts (το ίδιο ιδίωμα)
 *
 * POST { propertyId, documentKind, requireAccessCode } → `{ delivery, expiresAt, accessCode }`
 *   - νέος σύνδεσμος της σελίδας προκαταβολής (οι ζωντανοί μιας απόφασης είναι φραγμένοι)· σύνορο ιδεμποτίας ADR-872 μέσα
 *     στο `withAuth` (ένα πάτημα ⇒ ένα email, ακόμη κι αν ο πελάτης ξαναστείλει)
 *   - μόνο όταν ο ιδιοκτήτης έχει κάτι να κάνει (πληρωμή · αντίρρηση) — αλλιώς ονομασμένη άρνηση
 *   - `accessCode` (§29): ο ωμός κωδικός **μία** φορά, όταν ζητήθηκε — `null` αλλιώς
 *
 * ⛔ **Ποτέ αυτόματη αποστολή** (§18.5): εκτελεί μόνο ό,τι πάτησε άνθρωπος.
 * Δικαίωμα: `properties:properties:update` — ίδιο με τις υπόλοιπες πράξεις της ανάθεσης (§27).
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { requestAdvancePaymentFromOffice } from '@/server/issuance-invitations/issuance-advance-payment-request';

import { ADVANCE_LINK_REFUSAL_STATUS } from './advance-link-refusals';

const advanceLinkBody = z.object({
  propertyId: z.string().trim().min(1).max(128),
  documentKind: z.enum(DOCUMENT_KINDS),
  requireAccessCode: z.boolean(),
}).strict();

async function advanceLinkHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(advanceLinkBody, await request.json());
  if (parsed.error) return parsed.error;
  const result = await requestAdvancePaymentFromOffice(getAdminFirestore(), { companyId: ctx.companyId, uid: ctx.uid }, parsed.data, new Date());
  if (!result.ok) {
    const [status, code] = ADVANCE_LINK_REFUSAL_STATUS[result.refusal];
    throw new ApiError(status, 'Advance link refused', code);
  }
  return apiSuccess({ delivery: result.delivery, expiresAt: result.expiresAt, accessCode: result.accessCode });
}

export const POST = withStandardRateLimit(withAuth(advanceLinkHandler, { permissions: 'properties:properties:update' }));
