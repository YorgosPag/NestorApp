/**
 * @fileoverview `PUT /api/document-registry/issuance-assignments` — η ΑΝΑΘΕΣΗ ΕΚΔΟΣΗΣ σε επαγγελματία (ADR-915 §27).
 * @related services/document-registry/issuance-assignment.service.ts (η πράξη) · obligor-designations/route.ts (το ιδίωμα)
 *
 * PUT { action, propertyId, documentKind, expectedStage, … } → `{ outcome: 'changed' | 'unchanged', stage }`
 *   - `propose`  { professionalContactId, qualification, registryNumber } — το γραφείο ΠΡΟΤΕΙΝΕΙ
 *   - `decide`   { outcome, channel, note, expectedOwnerContactId } — καταγράφεται η απόφαση του ΥΠΕΥΘΥΝΟΥ ιδιοκτήτη
 *   - `notify`   { channel } — ο επαγγελματίας ενημερώθηκε
 *   - `respond`  { outcome } — αποδέχτηκε / αρνήθηκε
 *   - `cancel`
 *   - CAS: `expectedStage` = ό,τι είδε ο άνθρωπος· αλλαγή στο μεταξύ ⇒ 409 `STALE`, ποτέ σιωπηλή υπερκάλυψη
 *   - ίδια πρόταση ξανά ⇒ `unchanged`· σύνορο ιδεμποτίας ADR-872 μέσα στο `withAuth`
 *
 * Δικαίωμα: `properties:properties:update` — η ανάθεση αλλάζει γεγονός του ακινήτου (ίδιο με τον υπεύθυνο, §26).
 * Εμβέλεια = `ctx.companyId`· ακίνητο **άλλου** γραφείου ≡ ανύπαρκτο (404, ποτέ 403).
 */

import type { NextRequest } from 'next/server';

import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { issuanceAssignmentBody } from '@/lib/document-validity/issuance-request';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { actOnIssuanceAssignment, type IssuanceRefusal } from '@/services/document-registry/issuance-assignment.service';

/** Άρνηση → HTTP, κάθε λόγος ρητά (χωρίς `default`). Οι κωδικοί είναι και τα κλειδιά μηνυμάτων της οθόνης. */
const ISSUANCE_REFUSAL_STATUS: Readonly<Record<IssuanceRefusal, readonly [number, string]>> = {
  absent: [404, 'NOT_FOUND'],
  unavailable: [503, 'ASSIGNMENTS_UNAVAILABLE'],
  'contact-unavailable': [422, 'CONTACT_UNAVAILABLE'],
  unqualified: [422, 'UNQUALIFIED'],
  'lead-undesignated': [409, 'LEAD_UNDESIGNATED'],
  'lead-changed': [409, 'LEAD_CHANGED'],
  stale: [409, 'STALE'],
  'transition-refused': [409, 'TRANSITION_REFUSED'],
  // §28 — π.χ. καταγραφή απόφασης χωρίς κανάλι· δομικά ανέφικτο από τη φόρμα, άρα σφάλμα του πελάτη.
  'actor-refused': [422, 'ACTOR_REFUSED'],
};

async function issuanceHandler(request: NextRequest, ctx: AuthContext) {
  const parsed = safeParseBody(issuanceAssignmentBody, await request.json());
  if (parsed.error) return parsed.error;
  const result = await actOnIssuanceAssignment(
    getAdminFirestore(),
    { companyId: ctx.companyId, uid: ctx.uid, name: ctx.email },
    parsed.data,
    new Date(),
  );
  if (!result.ok) {
    const [status, code] = ISSUANCE_REFUSAL_STATUS[result.refusal];
    throw new ApiError(status, 'Issuance assignment refused', code);
  }
  return apiSuccess({ outcome: result.outcome, stage: result.stage });
}

export const PUT = withStandardRateLimit(withAuth(issuanceHandler, { permissions: 'properties:properties:update' }));
