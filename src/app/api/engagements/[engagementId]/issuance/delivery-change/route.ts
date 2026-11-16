/**
 * ADR-915 §45.20 Φ6γ — ο μηχανικός **ζητά** νέα ημερομηνία παράδοσης, από τον χώρο της συμμετοχής του.
 *
 * POST /api/engagements/{engagementId}/issuance/delivery-change
 *   { dueOn, reason, expectedStage } → `{ outcome: 'changed' | 'unchanged' }`
 *   - μόνο ο ίδιος, μέσω **δικής του** ενεργής συμμετοχής σε ανάθεση έκδοσης· ξένη / ανύπαρκτη ⇒ 404 (ίδιο)
 *   - αίτημα, **όχι** αλλαγή: το γραφείο ειδοποιείται και απαντά (νέα ημερομηνία ή απόρριψη με αιτιολογία)
 *   - ένα εκκρεμές τη φορά (409 `TRANSITION_REFUSED`) · ίδιο αίτημα ξανά ⇒ `unchanged`
 *   - CAS: `expectedStage` = ό,τι είδε ο άνθρωπος· αλλαγή στο μεταξύ ⇒ 409 `STALE`
 *   - σύνορο ιδεμποτίας ADR-872 μέσα στο `withPersonalOrOrgAuth` · ρυθμός STANDARD
 *
 * @module api/engagements/[engagementId]/issuance/delivery-change
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withPersonalOrOrgAuth } from '@/lib/auth/personal-scope-middleware';
import { ISSUANCE_STAGES } from '@/lib/document-validity/issuance-assignment';
import { DELIVERY_CHANGE_POLICY } from '@/lib/document-validity/issuance-delivery-change';
import { isoDay, requiredText } from '@/lib/document-validity/issuance-request';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requestIssuanceDeliveryChange, type DeliveryChangeRefusal } from '@/services/document-registry/issuance-delivery-change.service';
import { engagementPost } from '../../../_shared/engagement-post';

const BODY = z.object({
  dueOn: isoDay,
  reason: requiredText(DELIVERY_CHANGE_POLICY.reasonMax),
  expectedStage: z.enum(ISSUANCE_STAGES).nullable(),
});

/** Άρνηση → HTTP, κάθε λόγος ρητά. Οι κωδικοί είναι και τα κλειδιά μηνυμάτων της οθόνης. */
const REFUSAL_STATUS: Readonly<Record<DeliveryChangeRefusal, readonly [number, string]>> = {
  'not-found': [404, 'NOT_FOUND'],
  'not-engaged': [403, 'ENGAGEMENT_NOT_ACTIVE'],
  unavailable: [503, 'UNAVAILABLE'],
  stale: [409, 'STALE'],
  'transition-refused': [409, 'TRANSITION_REFUSED'],
  'terms-refused': [422, 'TERMS_REFUSED'],
  // Δομικά ανέφικτο από τη φόρμα (ο μειωτής επιτρέπει στη συμμετοχή μόνο το αίτημα).
  'actor-refused': [422, 'ACTOR_REFUSED'],
  unqualified: [422, 'UNQUALIFIED'],
  'receipt-mismatch': [422, 'RECEIPT_MISMATCH'],
};

const handler = engagementPost<Record<string, never>, typeof BODY>(BODY, async ({ db, uid, email, engagementId, body }) => {
  const result = await requestIssuanceDeliveryChange(db, {
    uid, name: email, engagementId, dueOn: body.dueOn, reason: body.reason, expectedStage: body.expectedStage, now: new Date(),
  });
  if (result.ok) return apiSuccess({ outcome: result.outcome });
  const [status, code] = REFUSAL_STATUS[result.refusal];
  return NextResponse.json({ success: false, error: code }, { status });
});

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
