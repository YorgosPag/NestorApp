/**
 * @fileoverview `POST /api/document-registry/issuance-assignments/space-invitation` — **«Νέος σύνδεσμος εισόδου»** στον
 *   χώρο της ανάθεσης (ADR-915 §39, μοτίβο Procore «Re-invite»).
 * @related server/issuance-invitations/issuance-space-invite.ts (η πράξη) · ../messages/route.ts (το ίδιο ιδίωμα)
 *
 * POST { propertyId, documentKind } → `{ delivery, expiresAt }`
 *   - ο νέος σύνδεσμος **ακυρώνει** τον παλιό (supersede, μία ζωντανή ανά ανάθεση)· σύνορο ιδεμποτίας ADR-872 μέσα στο
 *     `withAuth` (ένα πάτημα ⇒ ένα email, ακόμη κι αν ο πελάτης ξαναστείλει)
 *   - μόνο σε **αναληφθείσα** ανάθεση και μόνο όσο ο επαγγελματίας **δεν** έχει μπει — αλλιώς ονομασμένη άρνηση
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
import { inviteIssuanceProfessionalToSpace } from '@/server/issuance-invitations/issuance-space-invite';

import { SPACE_INVITE_REFUSAL_STATUS } from './space-invite-refusals';

const spaceInvitationBody = z.object({
  propertyId: z.string().trim().min(1).max(128),
  documentKind: z.enum(DOCUMENT_KINDS),
});

async function spaceInvitationHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(spaceInvitationBody, await request.json());
  if (parsed.error) return parsed.error;
  const sender = { companyId: ctx.companyId, uid: ctx.uid, name: ctx.email };
  const result = await inviteIssuanceProfessionalToSpace(getAdminFirestore(), sender, parsed.data, new Date());
  if (!result.ok) {
    const [status, code] = SPACE_INVITE_REFUSAL_STATUS[result.refusal];
    throw new ApiError(status, 'Space invitation refused', code);
  }
  return apiSuccess({ delivery: result.delivery, expiresAt: result.expiresAt });
}

export const POST = withStandardRateLimit(withAuth(spaceInvitationHandler, { permissions: 'properties:properties:update' }));
