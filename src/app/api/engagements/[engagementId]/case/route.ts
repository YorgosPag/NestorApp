/**
 * ADR-901 Φ2 · ADR-862 Φ1 — Η υπόθεση, μέσω της συμμετοχής του θεατή (ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ).
 *
 * GET /api/engagements/{engagementId}/case → `{ view: EngagedCaseView }`
 *   - **ΠΟΤΕ** το ωμό `conveyance_cases` έγγραφο: ο κατάλογος έρχεται φιλτραρισμένος ανά **ρόλο**
 *     (`visibleTo`) και ανά **εμβέλεια** (WIP μηχανικού ⛔ — `decideEngagedEvidenceReach`)
 *   - η κρίση `decideEngagement` τρέχει σε **κάθε** αίτημα — ανάκληση = άμεση, χωρίς cache
 *   - δική του συμμετοχή χωρίς πρόσβαση τώρα ⇒ 403 με **ονομασμένο** λόγο (offered · revoked · expired · …)
 *   - ξένη/ανύπαρκτη ⇒ 404 (καμία μαρτυρία ύπαρξης) · «δεν μπόρεσα να ρωτήσω» ⇒ 503
 *
 * @module api/engagements/[engagementId]/case
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { getEngagedCaseView } from '@/services/conveyance/conveyance-engagement-access.service';

type Segment = { params: Promise<{ engagementId: string }> };

async function handler(_request: NextRequest, actor: ApiActor, segmentData?: Segment) {
  const { engagementId } = await segmentData!.params;
  const outcome = await getEngagedCaseView(requireAdminFirestore(), actor.ctx.uid, engagementId, Date.now());
  if (outcome.ok) return apiSuccess({ view: outcome.view });
  if (outcome.rejection === 'denied') {
    return NextResponse.json({ success: false, error: 'ENGAGEMENT_NOT_ACTIVE', verdict: outcome.verdict }, { status: 403 });
  }
  const status = outcome.rejection === 'unknown' ? 503 : 404;
  return NextResponse.json({ success: false, error: outcome.rejection }, { status });
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(handler));
