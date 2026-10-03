/**
 * ADR-901 Φ4.4 §5.8.1 — ο συντάκτης **αποσύρει** μια αποστολή του.
 *
 * POST /api/engagements/{engagementId}/contributions/{contributionId}/withdraw
 *   → `{ kind: 'withdrawn' | 'already-withdrawn', contribution }`
 *   - μόνο ο συντάκτης, με ενεργή συμμετοχή, εντός της πολιτικής κατάστασης (πάγωμα ⇒ 409)
 *   - ρητή πράξη με ίχνος — ο κάδος του αρχείου **δεν** είναι απόσυρση
 *   - η δέσμευση της έκδοσης αίρεται **μόνο** αν καμία άλλη ζωντανή αποστολή δεν την καρφώνει (Α26)
 *   - ξένη / ανύπαρκτη αποστολή ⇒ 404 (ίδιο)
 *
 * @module api/engagements/[engagementId]/contributions/[contributionId]/withdraw
 */

import { z } from 'zod';
import { withPersonalOrOrgAuth } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { withdrawContribution } from '@/services/conveyance/conveyance-contribution.service';
import { contributionResponse } from '../../../../_shared/contribution-response';
import { engagementPost } from '../../../../_shared/engagement-post';

/** Χωρίς σώμα — ό,τι χρειάζεται είναι στη διαδρομή. */
const EMPTY_BODY = z.object({});

const handler = engagementPost<{ contributionId: string }, typeof EMPTY_BODY>(EMPTY_BODY, async ({ db, uid, engagementId, param }) =>
  contributionResponse(await withdrawContribution(db, { uid, engagementId, contributionId: param('contributionId'), nowMs: Date.now() }), uid));

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
