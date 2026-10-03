/**
 * ADR-901 Φ4 §5.9 — το ίχνος της υπόθεσης όπως το βλέπει ο **επαγγελματίας**.
 *
 * GET /api/engagements/{engagementId}/activity → `{ items: CaseActivityItem[] }`
 *   - **προβολή**, ποτέ ωμές εγγραφές: οι δικές του ενέργειες + όσοι άνοιξαν τα δικά του αρχεία (μόνο ρόλος)
 *   - η κρίση `decideEngagement` τρέχει σε **κάθε** αίτημα · ξένη/ανύπαρκτη ⇒ 404 · «δεν μπόρεσα» ⇒ 503
 *
 * @module api/engagements/[engagementId]/activity
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { getCaseActivity } from '@/services/conveyance/conveyance-case-activity.server';

type Segment = { params: Promise<{ engagementId: string }> };

async function handler(_request: NextRequest, actor: ApiActor, segmentData?: Segment) {
  const { engagementId } = await segmentData!.params;
  const outcome = await getCaseActivity(requireAdminFirestore(), actor.ctx.uid, decodeRouteParam(engagementId), Date.now());
  if (outcome.ok) return apiSuccess({ items: outcome.items });
  if (outcome.rejection === 'denied') {
    return NextResponse.json({ success: false, error: 'ENGAGEMENT_NOT_ACTIVE', verdict: outcome.verdict }, { status: 403 });
  }
  return NextResponse.json({ success: false, error: outcome.rejection }, { status: outcome.rejection === 'unknown' ? 503 : 404 });
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(handler));
