/**
 * @fileoverview `PUT /api/document-registry/document-facts` — «Συμπλήρωση στοιχείων» εγγράφου από το μητρώο (ADR-915 §33).
 * @related services/document-registry/facts-declaration.service.ts (η πράξη) · app/api/document-registry/route.ts
 *
 * PUT { fileId, kind, issuedOn, printedValidUntil, classification, storagePath } → `{ outcome: 'changed' | 'unchanged' }`
 *   - ο server κρίνει ότι το αρχείο είναι ζωντανό αρχείο **του γραφείου** και ότι η θέση του φιλοξενεί το είδος
 *   - γράφει **μόνο** ο ΕΝΑΣ γραφέας (`recordDocumentFacts`): ιεραρχία + CAS μέσα στη συναλλαγή του
 *   - ίδια στοιχεία ξανά ⇒ `unchanged`, κανένα ίχνος· σύνορο ιδεμποτίας ADR-872 μέσα στο `withAuth`
 *
 * Δικαίωμα: `properties:properties:update` — ίδιο με κάθε εγγραφή του μητρώου (§26 · §27). Εμβέλεια = `ctx.companyId`·
 * αρχείο **άλλου** γραφείου ≡ ανύπαρκτο (404, ποτέ 403 που θα επιβεβαίωνε ότι υπάρχει).
 */

import type { NextRequest } from 'next/server';

import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import {
  FACTS_DECLARATION_ERROR_CODES,
  factsDeclarationBody,
  type FactsDeclarationServiceRefusal,
} from '@/lib/document-validity/facts-declaration';
import { declareDocumentFacts } from '@/services/document-registry/facts-declaration.service';

/** Άρνηση → HTTP, κάθε λόγος ρητά (χωρίς `default`). Ο κωδικός ζει στον κοινό πίνακα που διαβάζει και η οθόνη. */
const REFUSAL_STATUS: Readonly<Record<FactsDeclarationServiceRefusal, number>> = {
  absent: 404,
  'kind-not-promised': 422,
  'not-this-object': 409,
  outranked: 409,
  empty: 422,
  'invalid-date': 422,
  'not-printed': 422,
  'validity-before-issue': 422,
  'classification-invalid': 422,
};

async function declarationHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(factsDeclarationBody, await request.json());
  if (parsed.error) return parsed.error;
  const result = await declareDocumentFacts(getAdminFirestore(), { companyId: ctx.companyId, uid: ctx.uid }, parsed.data);
  if (!result.ok) {
    throw new ApiError(REFUSAL_STATUS[result.refusal], 'Document facts declaration refused', FACTS_DECLARATION_ERROR_CODES[result.refusal]);
  }
  return apiSuccess({ outcome: result.outcome });
}

export const PUT = withStandardRateLimit(withAuth(declarationHandler, { permissions: 'properties:properties:update' }));
