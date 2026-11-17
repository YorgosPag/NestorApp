/**
 * ADR-943 Φ5α — ο μηχανικός δηλώνει **«Έγινε η αυτοψία»**, από τον χώρο της συμμετοχής του.
 *
 * POST /api/engagements/{engagementId}/issuance/start-work
 *   { expectedStage } → `{ outcome: 'changed' | 'unchanged', releaseAt }`
 *   - μόνο ο ίδιος, μέσω **δικής του** ενεργής συμμετοχής σε ανάθεση έκδοσης· ξένη / ανύπαρκτη ⇒ 404 (ίδιο)
 *   - μόνο όταν η προκαταβολή **κρατείται** (409 `TRANSITION_REFUSED` αλλιώς)· ξανά ⇒ `unchanged`
 *   - ανοίγει παράθυρο αντίρρησης 48ω· στο τέλος του η προκαταβολή αποδεσμεύεται αυτόματα (`releaseAt`)
 *   - η εντολή αποδέσμευσης δεν γράφτηκε ⇒ 503 `SETTLEMENT_UNAVAILABLE` (ξαναπάτημα την ολοκληρώνει)
 *   - CAS: `expectedStage` = ό,τι είδε ο άνθρωπος· αλλαγή στο μεταξύ ⇒ 409 `STALE`
 *   - σύνορο ιδεμποτίας ADR-872 μέσα στο `withPersonalOrOrgAuth` · ρυθμός STANDARD
 *
 * @module api/engagements/[engagementId]/issuance/start-work
 */

import { z } from 'zod';

import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withPersonalOrOrgAuth } from '@/lib/auth/personal-scope-middleware';
import { ISSUANCE_STAGES } from '@/lib/document-validity/issuance-assignment';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { declareIssuanceWorkStarted, type AdvanceStartRefusal } from '@/services/document-registry/issuance-advance-start.service';
import { engagementPost } from '../../../_shared/engagement-post';
import { ENGAGEMENT_ISSUANCE_REFUSAL_STATUS, issuanceRefusalResponse } from '../../../_shared/issuance-action-response';

const BODY = z.object({ expectedStage: z.enum(ISSUANCE_STAGES).nullable() });

const REFUSAL_STATUS: Readonly<Record<AdvanceStartRefusal, readonly [number, string]>> = {
  ...ENGAGEMENT_ISSUANCE_REFUSAL_STATUS,
  'settlement-unavailable': [503, 'SETTLEMENT_UNAVAILABLE'],
};

const handler = engagementPost<Record<string, never>, typeof BODY>(BODY, async ({ db, uid, email, engagementId, body }) => {
  const result = await declareIssuanceWorkStarted(db, { uid, name: email, engagementId, expectedStage: body.expectedStage, now: new Date() });
  if (result.ok) return apiSuccess({ outcome: result.outcome, releaseAt: result.releaseAt });
  return issuanceRefusalResponse(REFUSAL_STATUS, result.refusal);
});

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
