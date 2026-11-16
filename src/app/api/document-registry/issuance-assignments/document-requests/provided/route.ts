/**
 * @fileoverview `POST /api/document-registry/issuance-assignments/document-requests/provided` — το γραφείο ανέβασε ένα
 *   έγγραφο **ως απάντηση** σε αίτημα του μηχανικού: ο server κρίνει μόνος του, το **δίνει** (ADR-942 Φ2, δρόμος `upload`)
 *   και ειδοποιεί όσους το ζήτησαν (Φ1, Δ8).
 * @related services/document-registry/issuance-document-provided.service.ts (η πράξη) · `…/provisions` (υπάρχον · ανάκληση)
 *
 * POST { propertyId, documentKind, fileId } → `{ outcome, notified }`
 *   - το αρχείο ξαναδιαβάζεται: ζωντανό, στο δοχείο του **κατόχου**, είδος του καταλόγου — αλλιώς 404
 *   - η ανάθεση δεν εκτελείται πια ⇒ 409 (κανένα νέο δόσιμο)
 *   - ιδεμποτικό: ίδιο αρχείο ⇒ `already-given`, κανένα δεύτερο ίχνος ή ειδοποίηση — και σύνορο ADR-872
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
import { giveIssuanceDocument } from '@/services/document-registry/issuance-document-provided.service';
import { provisionRefusalError } from '../_shared/provision-errors';

const providedBody = z.object({
  propertyId: z.string().trim().min(1).max(128),
  documentKind: z.enum(DOCUMENT_KINDS),
  fileId: z.string().trim().min(1).max(128),
});

async function providedHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(providedBody, await request.json());
  if (parsed.error) return parsed.error;
  const result = await giveIssuanceDocument(getAdminFirestore(), {
    companyId: ctx.companyId, ...parsed.data, via: 'upload', uid: ctx.uid, nowMs: Date.now(),
  });
  if (!result.ok) throw provisionRefusalError(result.rejection);
  return apiSuccess({ outcome: result.outcome, notified: result.notified });
}

export const POST = withStandardRateLimit(withAuth(providedHandler, { permissions: 'properties:properties:update' }));
