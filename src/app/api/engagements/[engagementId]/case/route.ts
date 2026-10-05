/**
 * ADR-901 Φ2 · §15 Γ2 · ADR-862 Φ1 — Η υπόθεση, μέσω της συμμετοχής του θεατή (ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ).
 *
 * GET /api/engagements/{engagementId}/case?home=org|personal → `{ view: EngagedCaseView }`
 *   - **ΠΟΤΕ** το ωμό `conveyance_cases` έγγραφο: ο κατάλογος έρχεται φιλτραρισμένος ανά **ρόλο**
 *     (`visibleTo`) και ανά **εμβέλεια** (WIP μηχανικού ⛔ — `decideEngagedEvidenceReach`)
 *   - η κρίση `decideEngagement` τρέχει σε **κάθε** αίτημα — ανάκληση = άμεση, χωρίς cache
 *   - δική του συμμετοχή χωρίς πρόσβαση τώρα ⇒ 403 με **ονομασμένο** λόγο (offered · revoked · expired · …)
 *   - §15 Γ2 — δική του υπόθεση ανοιγμένη σε **λάθος χώρο** ⇒ 409 `ENGAGEMENT_ELSEWHERE` + η διεύθυνση του σπιτιού
 *     της (`location`): ποτέ 404 για δική του υπόθεση, ποτέ άνοιγμα κάτω από ξένο πρόθεμα
 *   - ξένη/ανύπαρκτη ⇒ 404 (καμία μαρτυρία ύπαρξης) · «δεν μπόρεσα να ρωτήσω» ⇒ 503
 *
 * @module api/engagements/[engagementId]/case
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { activeWorkspaceOf } from '@/lib/auth/workspace-membership';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { myCaseHref } from '@/lib/conveyance/conveyance-routes';
import { addressInWorkspace } from '@/lib/workspace/workspace-address';
import { readCaseViewer } from '@/services/conveyance/conveyance-case-viewer.server';
import { getEngagedCaseView } from '@/services/conveyance/conveyance-engagement-access.service';

type Segment = { params: Promise<{ engagementId: string }> };

async function handler(request: NextRequest, actor: ApiActor, segmentData?: Segment) {
  const { engagementId } = await segmentData!.params;
  const viewer = readCaseViewer(request, { uid: actor.ctx.uid, active: activeWorkspaceOf(actor) });
  if ('rejected' in viewer) return viewer.rejected;
  const outcome = await getEngagedCaseView(requireAdminFirestore(), viewer, engagementId, Date.now());
  if (outcome.ok) return apiSuccess({ view: outcome.view });
  if (outcome.rejection === 'denied') {
    return NextResponse.json({ success: false, error: 'ENGAGEMENT_NOT_ACTIVE', verdict: outcome.verdict }, { status: 403 });
  }
  if (outcome.rejection === 'elsewhere') {
    // Η διεύθυνση χτίζεται από τον χώρο της ΣΥΜΜΕΤΟΧΗΣ (ο ΕΝΑΣ κανόνας «χώρος → διεύθυνση») — ο πελάτης δεν μαντεύει ψευδώνυμο.
    const location = await addressInWorkspace(outcome.home, myCaseHref(engagementId, outcome.home.kind));
    return NextResponse.json({ success: false, error: 'ENGAGEMENT_ELSEWHERE', location }, { status: 409 });
  }
  const status = outcome.rejection === 'unknown' ? 503 : 404;
  return NextResponse.json({ success: false, error: outcome.rejection }, { status });
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(handler));
