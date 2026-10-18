/**
 * @fileoverview `PUT /api/document-registry/upkeep-declarations` — η απόφαση μόνιμης υποχρέωσης ακινήτου (ADR-915 §35).
 * @related services/document-registry/upkeep-declaration.service.ts (η πράξη) · lib/document-validity/upkeep-declaration-request.ts
 *
 * PUT { propertyId, documentKind, decision: 'required' | 'not-required' | null, exemptionReason } → `{ outcome }`
 *   - `decision: null` ⇒ «ξανά ρώτα»: η απόφαση σβήνεται, γυρίζει η πρόταση
 *   - εξαίρεση **πάντα** με λόγο (400 αλλιώς) · η πρόταση της στιγμής την υπολογίζει ο server, ποτέ ο πελάτης
 *   - ίδια απόφαση ξανά ⇒ `unchanged`, καμία εγγραφή, κανένα ίχνος· σύνορο ιδεμποτίας ADR-872 μέσα στο `withAuth`
 *
 * Δικαίωμα: `properties:properties:update` — η απόφαση αλλάζει **γεγονός του ακινήτου** που βλέπουν όλοι. Εμβέλεια =
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
  UPKEEP_DECLARATION_ERROR_CODES,
  upkeepDeclarationBody,
  type UpkeepDeclarationRefusal,
} from '@/lib/document-validity/upkeep-declaration-request';
import { declareRegistryUpkeep } from '@/services/document-registry/upkeep-declaration.service';

/** Άρνηση → HTTP, κάθε λόγος ρητά (χωρίς `default`)· ο κωδικός από τον ΕΝΑ πίνακα που διαβάζει και η οθόνη. */
const REFUSAL_STATUS: Readonly<Record<UpkeepDeclarationRefusal, number>> = {
  absent: 404,
  'not-standing': 422,
};

async function upkeepDeclarationHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(upkeepDeclarationBody, await request.json());
  if (parsed.error) return parsed.error;
  const result = await declareRegistryUpkeep(
    getAdminFirestore(),
    { companyId: ctx.companyId, uid: ctx.uid, name: ctx.email },
    parsed.data,
    new Date(),
  );
  if (!result.ok) {
    throw new ApiError(REFUSAL_STATUS[result.refusal], 'Upkeep declaration refused', UPKEEP_DECLARATION_ERROR_CODES[result.refusal]);
  }
  return apiSuccess({ outcome: result.outcome });
}

export const PUT = withStandardRateLimit(withAuth(upkeepDeclarationHandler, { permissions: 'properties:properties:update' }));
