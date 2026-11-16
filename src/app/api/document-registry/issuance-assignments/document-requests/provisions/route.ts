/**
 * @fileoverview `POST /api/document-registry/issuance-assignments/document-requests/provisions` — το γραφείο **δίνει**
 *   στον μηχανικό αρχείο που υπήρχε ήδη στον φάκελο, ή **ανακαλεί** ένα δόσιμο (ADR-942 Φ2).
 * @related services/document-registry/issuance-document-provided.service.ts (η πράξη) · `…/provided` (ανέβασμα ως απάντηση)
 *
 * POST { action: 'give', propertyId, documentKind, fileId }        → `{ outcome: 'given' | 'already-given', notified }`
 * POST { action: 'revoke', propertyId, documentKind, provisionId } → `{ outcome: 'revoked' | 'already-revoked' }`
 *   - «δώσε»: ρητή πράξη του γραφείου, **αφού** είδε τη δήλωση σκοπού (ΓΚΠΔ άρθρο 13) — η οθόνη τη δείχνει πριν το πάτημα
 *   - το αρχείο ξαναδιαβάζεται: ζωντανό, στο δοχείο του **κατόχου**, είδος του καταλόγου — αλλιώς 404
 *   - «δώσε» σε ανάθεση που δεν εκτελείται ⇒ 409 · η ανάκληση επιτρέπεται **πάντα**
 *   - ιδεμποτικό: δεύτερο ίδιο πάτημα ⇒ `already-…`, κανένα δεύτερο ίχνος — και σύνορο ADR-872
 *
 * Δικαίωμα: `properties:properties:update` — ίδιο με τις υπόλοιπες πράξεις της ανάθεσης (ADR-915 §27).
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { giveIssuanceDocument, revokeIssuanceDocument } from '@/services/document-registry/issuance-document-provided.service';
import { provisionRefusalError } from '../_shared/provision-errors';

const assignmentFields = {
  propertyId: z.string().trim().min(1).max(128),
  documentKind: z.enum(DOCUMENT_KINDS),
};

const provisionBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('give'), ...assignmentFields, fileId: z.string().trim().min(1).max(128) }),
  z.object({ action: z.literal('revoke'), ...assignmentFields, provisionId: z.string().trim().min(1).max(128) }),
]);

async function provisionsHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(provisionBody, await request.json());
  if (parsed.error) return parsed.error;
  const db = getAdminFirestore();
  const body = parsed.data;
  const ref = { companyId: ctx.companyId, propertyId: body.propertyId, documentKind: body.documentKind, uid: ctx.uid, nowMs: Date.now() };
  if (body.action === 'give') {
    const given = await giveIssuanceDocument(db, { ...ref, fileId: body.fileId, via: 'existing' });
    if (!given.ok) throw provisionRefusalError(given.rejection);
    return apiSuccess({ outcome: given.outcome, notified: given.notified });
  }
  const revoked = await revokeIssuanceDocument(db, { ...ref, provisionId: body.provisionId });
  if (!revoked.ok) throw provisionRefusalError(revoked.rejection);
  return apiSuccess({ outcome: revoked.outcome });
}

export const POST = withStandardRateLimit(withAuth(provisionsHandler, { permissions: 'properties:properties:update' }));
