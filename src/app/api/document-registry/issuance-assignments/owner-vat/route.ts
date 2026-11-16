/**
 * @fileoverview `POST /api/document-registry/issuance-assignments/owner-vat` — **«Εφαρμογή στην επαφή»** της διόρθωσης ΑΦΜ που
 *   δήλωσε ο ιδιοκτήτης στη σελίδα έγκρισης (ADR-915 §45.15 1β-γ-2, μοτίβο Salesforce staging).
 * @related server/issuance-invitations/issuance-owner-vat-correction.ts (η πράξη) · ../delivery-reminder/route.ts (το ίδιο ιδίωμα)
 *
 * POST { propertyId, documentKind, contactId, vatNumber } → `{ result: 'applied' | 'unchanged' }`
 *   - σύνορο ιδεμποτίας ADR-872 μέσα στο `withAuth` — και η πράξη είναι ιδεμποτική εκ κατασκευής (`unchanged`)
 *   - γράφεται **μόνο** η διόρθωση που υπάρχει στο τεκμήριο της απόφασης (CAS) — ποτέ ελεύθερο ΑΦΜ
 *   - ξένη επαφή ≡ ανύπαρκτη
 *
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
import { isValidGreekVat } from '@/lib/validation/greek-vat-number';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { applyOwnerVatCorrection } from '@/server/issuance-invitations/issuance-owner-vat-correction';

import { OWNER_VAT_REFUSAL_STATUS } from './owner-vat-refusals';

const ownerVatBody = z.object({
  propertyId: z.string().trim().min(1).max(128),
  documentKind: z.enum(DOCUMENT_KINDS),
  contactId: z.string().trim().min(1).max(128),
  vatNumber: z.string().trim().max(32).refine(isValidGreekVat),
});

async function ownerVatHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(ownerVatBody, await request.json());
  if (parsed.error) return parsed.error;
  const outcome = await applyOwnerVatCorrection(getAdminFirestore(), { companyId: ctx.companyId, uid: ctx.uid }, parsed.data);
  if (!outcome.ok) {
    const [status, code] = OWNER_VAT_REFUSAL_STATUS[outcome.refusal];
    throw new ApiError(status, 'Owner VAT correction refused', code);
  }
  return apiSuccess({ result: outcome.result });
}

export const POST = withStandardRateLimit(withAuth(ownerVatHandler, { permissions: 'properties:properties:update' }));
