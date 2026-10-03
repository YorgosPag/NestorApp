/**
 * ADR-901 Φ4.4 §5.8.1 — ο επαγγελματίας **στέλνει** (transmittal) μια έκδοση δικού του αρχείου σε γραμμή της υπόθεσης.
 *
 * POST /api/engagements/{engagementId}/contributions { checklistItemId, entryPointId, fileId }
 *   → `{ kind: 'issued' | 'already-issued', contribution }`
 *   - ο ΕΝΑΣ γραφέας κρίνει: συμμετοχή ανά αίτημα · ρόλος × κατάσταση × γραμμή · το αρχείο στον server
 *   - ⛔ **κανένα ακροατήριο** στο σώμα: το ορίζει ο ρόλος (Α23)
 *   - ιδεμπότητο δύο φορές: σύνορο ADR-872 (`Idempotency-Key`) **και** εκ κατασκευής (ίδια έκδοση ⇒ `already-issued`)
 *
 * @module api/engagements/[engagementId]/contributions
 */

import { z } from 'zod';
import { withPersonalOrOrgAuth } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { issueContribution } from '@/services/conveyance/conveyance-contribution.service';
import { contributionResponse } from '../../_shared/contribution-response';
import { engagementPost } from '../../_shared/engagement-post';

const bodySchema = z.object({
  checklistItemId: z.string().min(1).max(100),
  entryPointId: z.string().min(1).max(100),
  fileId: z.string().min(1).max(200),
});

const handler = engagementPost(bodySchema, async ({ db, uid, engagementId, body }) =>
  contributionResponse(await issueContribution(db, { uid, engagementId, nowMs: Date.now(), ...body }), uid));

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
