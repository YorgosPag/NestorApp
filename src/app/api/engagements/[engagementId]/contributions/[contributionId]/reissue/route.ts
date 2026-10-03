/**
 * ADR-901 Φ4.5 — «Στείλε τη νέα έκδοση στους ίδιους» με ένα πάτημα (Aconex «auto update transmittal»).
 *
 * POST /api/engagements/{engagementId}/contributions/{contributionId}/reissue
 *   → `{ kind: 'issued' | 'already-issued', contribution }`
 *   - ο client λέει **μόνο** ποια αποστολή· η έκδοση που φεύγει είναι η **κεφαλή** της στοίβας του συντάκτη — την
 *     αποφασίζει ο server, ποτέ το σύρμα (Α27)
 *   - ίδιος δρόμος με την αποστολή: κριτής ρόλου × κατάστασης (πάγωμα ⇒ 409) · ακροατήριο από τον ρόλο · `supersedes`
 *   - καμία νεότερη έκδοση ⇒ 422 `no-newer-version` · η αποστολή δεν είναι πια η τελευταία ⇒ 422 `superseded`
 *   - ξένη / ανύπαρκτη / αποσυρμένη αποστολή ⇒ 404 (ίδιο)
 *
 * @module api/engagements/[engagementId]/contributions/[contributionId]/reissue
 */

import { z } from 'zod';
import { withPersonalOrOrgAuth } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { reissueContribution } from '@/services/conveyance/conveyance-contribution.service';
import { contributionResponse } from '../../../../_shared/contribution-response';
import { engagementPost } from '../../../../_shared/engagement-post';

/** Χωρίς σώμα — ό,τι χρειάζεται είναι στη διαδρομή. */
const EMPTY_BODY = z.object({});

const handler = engagementPost<{ contributionId: string }, typeof EMPTY_BODY>(EMPTY_BODY, async ({ db, uid, engagementId, param }) =>
  contributionResponse(await reissueContribution(db, { uid, engagementId, contributionId: param('contributionId'), nowMs: Date.now() }), uid));

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
