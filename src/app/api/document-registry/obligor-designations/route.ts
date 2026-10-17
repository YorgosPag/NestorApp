/**
 * @fileoverview `PUT /api/document-registry/obligor-designations` — ο ΡΗΤΟΣ υπεύθυνος εγγράφων ακινήτου (ADR-915 §26).
 * @related services/document-registry/obligor-designation.service.ts (η πράξη) · app/api/document-registry/route.ts
 *
 * PUT { propertyId, contactId | null } → `{ outcome: 'changed' | 'unchanged' }`
 *   - `contactId: null` ⇒ επαναφορά στην αυτόματη επιλογή (πλειοψηφία μεριδίων · μοναδικός · κύριος πωλητής)
 *   - ο server κρίνει «είναι ιδιοκτήτης;» με τον ΙΔΙΟ αναγνώστη που έφτιαξε την οθόνη — ποτέ ο πελάτης
 *   - ίδια επιλογή ξανά ⇒ `unchanged`, καμία εγγραφή, κανένα ίχνος· σύνορο ιδεμποτίας ADR-872 μέσα στο `withAuth`
 *
 * Δικαίωμα: `properties:properties:update` — ο ορισμός αλλάζει **γεγονός του ακινήτου** που βλέπουν όλοι. Εμβέλεια =
 * `ctx.companyId`· ακίνητο **άλλου** γραφείου ≡ ανύπαρκτο (404, ποτέ 403 που θα επιβεβαίωνε ότι υπάρχει).
 */

import type { NextRequest } from 'next/server';

import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import {
  designateRegistryObligor,
  obligorDesignationBody,
  type ObligorDesignationResult,
} from '@/services/document-registry/obligor-designation.service';

type Refusal = Extract<ObligorDesignationResult, { ok: false }>['refusal'];

/** Άρνηση → HTTP, κάθε λόγος ρητά (χωρίς `default`). */
const REFUSAL_STATUS: Readonly<Record<Refusal, readonly [number, string]>> = {
  absent: [404, 'NOT_FOUND'],
  'owners-unknown': [409, 'OWNERS_UNKNOWN'],
  'not-an-owner': [422, 'NOT_AN_OWNER'],
};

async function designationHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(obligorDesignationBody, await request.json());
  if (parsed.error) return parsed.error;
  const result = await designateRegistryObligor(
    getAdminFirestore(),
    { companyId: ctx.companyId, uid: ctx.uid, name: ctx.email },
    parsed.data,
    new Date(),
  );
  if (!result.ok) {
    const [status, code] = REFUSAL_STATUS[result.refusal];
    throw new ApiError(status, 'Obligor designation refused', code);
  }
  return apiSuccess({ outcome: result.outcome });
}

export const PUT = withStandardRateLimit(withAuth(designationHandler, { permissions: 'properties:properties:update' }));
