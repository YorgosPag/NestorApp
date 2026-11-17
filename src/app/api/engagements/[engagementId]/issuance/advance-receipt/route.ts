/**
 * ADR-943 Φ5δ (Κ-7) — ο μηχανικός καταγράφει τον **ΜΑΡΚ του παραστατικού της προκαταβολής**, από τον χώρο της συμμετοχής του.
 *
 * POST /api/engagements/{engagementId}/issuance/advance-receipt
 *   { expectedStage, mark, issuedOn, totalMinor } → `{ outcome: 'changed' | 'unchanged' }`
 *   - μόνο ο ίδιος, μέσω **δικής του** ενεργής συμμετοχής σε ανάθεση έκδοσης· ξένη / ανύπαρκτη ⇒ 404 (ίδιο)
 *   - ποσό = ό,τι εισπράχθηκε, έγκυρος ΜΑΡΚ (422 `RECEIPT_MISMATCH` αλλιώς)· ίδιος ΜΑΡΚ ξανά ⇒ `unchanged` · άλλος ⇒ 409
 *   - ο ΙΔΙΟΣ δρόμος πράξης μηχανικού (`writeEngagementIssuanceAction`) με την αυτοψία και το αίτημα ημερομηνίας
 *   - CAS: `expectedStage` = ό,τι είδε ο άνθρωπος· αλλαγή στο μεταξύ ⇒ 409 `STALE`
 *   - σύνορο ιδεμποτίας ADR-872 μέσα στο `withPersonalOrOrgAuth` · ρυθμός STANDARD
 *
 * @module api/engagements/[engagementId]/issuance/advance-receipt
 */

import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { withPersonalOrOrgAuth } from '@/lib/auth/personal-scope-middleware';
import { issuanceAdvanceReceiptBody } from '@/lib/document-validity/issuance-request';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { writeEngagementIssuanceAction } from '@/services/document-registry/issuance-engagement-action.server';
import { engagementPost } from '../../../_shared/engagement-post';
import { ENGAGEMENT_ISSUANCE_REFUSAL_STATUS, issuanceRefusalResponse } from '../../../_shared/issuance-action-response';

const handler = engagementPost<Record<string, never>, typeof issuanceAdvanceReceiptBody>(issuanceAdvanceReceiptBody, async ({ db, uid, email, engagementId, body }) => {
  const result = await writeEngagementIssuanceAction(db, {
    uid, name: email, engagementId, expectedStage: body.expectedStage, now: new Date(),
    action: { kind: 'record-advance-receipt', mark: body.mark, issuedOn: body.issuedOn, totalMinor: body.totalMinor },
  });
  if (result.ok) return apiSuccess({ outcome: result.outcome.outcome });
  return issuanceRefusalResponse(ENGAGEMENT_ISSUANCE_REFUSAL_STATUS, result.refusal);
});

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
