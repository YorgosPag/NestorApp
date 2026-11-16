/**
 * @fileoverview `POST /api/document-registry/issuance-assignments/document-requests/provided` — το γραφείο ανέβασε ένα
 *   έγγραφο που ζήτησε ο μηχανικός· ο server **κρίνει μόνος του** και ειδοποιεί (ADR-942 Φ1, Δ8).
 * @related services/document-registry/issuance-document-provided.service.ts (η πράξη)
 *
 * POST { propertyId, documentKind, fileId } → `{ notified }`
 *   - το αρχείο ξαναδιαβάζεται: ζωντανό, στο δοχείο του **κατόχου**, είδος του καταλόγου — αλλιώς 404
 *   - ιδεμποτικό: ίδιο αρχείο ⇒ ίδιο `eventId` ανά μηχανικό (καμία δεύτερη ειδοποίηση) — και σύνορο ADR-872
 *   - δίχτυ ασφαλείας: αν χαθεί, ο μηχανικός βλέπει ήδη «Υπάρχει στον φάκελο» (η κατάσταση **παράγεται**)
 *
 * Δικαίωμα: `properties:properties:update` — ίδιο με τις υπόλοιπες πράξεις της ανάθεσης (ADR-915 §27).
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
import { announceIssuanceDocumentProvided } from '@/services/document-registry/issuance-document-provided.service';

const providedBody = z.object({
  propertyId: z.string().trim().min(1).max(128),
  documentKind: z.enum(DOCUMENT_KINDS),
  fileId: z.string().trim().min(1).max(128),
});

async function providedHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(providedBody, await request.json());
  if (parsed.error) return parsed.error;
  const result = await announceIssuanceDocumentProvided(getAdminFirestore(), { companyId: ctx.companyId, ...parsed.data });
  if (!result.ok) {
    throw result.rejection === 'not-found'
      ? new ApiError(404, 'File is not a requested document of this assignment', 'NOT_FOUND')
      : new ApiError(503, 'Document requests could not be read', 'UNAVAILABLE');
  }
  return apiSuccess({ notified: result.notified });
}

export const POST = withStandardRateLimit(withAuth(providedHandler, { permissions: 'properties:properties:update' }));
