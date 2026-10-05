/**
 * ADR-901 Φ2 §5.4 · §15 Γ2 · ADR-862 Φ1 — «Οι υποθέσεις μου»: οι συμμετοχές του ανθρώπου σε ξένες υποθέσεις.
 *
 * GET /api/engagements?home=org|personal → `{ cards: MyCaseCard[] }` — μία κάρτα ανά υπόθεση (η τρέχουσα συμμετοχή)
 *
 * 🔑 `withPersonalOrOrgAuth`: ο δικηγόρος μπορεί να είναι ιδιώτης **χωρίς** οργανισμό (ADR-817) ή μέλος
 *    του **δικού του** γραφείου — η λίστα είναι **του ανθρώπου** (`uid` από το token).
 * 🔑 §15 Γ2 (Α6) — **μία λίστα, φίλτρο ο χώρος της σελίδας**: `home=org` ⇒ όσες ενεργούν για το γραφείο του
 *    αιτήματος· `home=personal` ⇒ όσες ζουν στον προσωπικό χώρο· οι προτάσεις που περιμένουν απάντηση ⇒ παντού.
 *    Η παράμετρος δηλώνει **είδος**, ποτέ εταιρεία: την ταυτότητα του γραφείου τη δίνει ο **κριμένος** χώρος του
 *    αιτήματος (`activeWorkspaceOf`). Στενεύει, δεν ανοίγει — το «ποιος βλέπει» μένει `decideEngagement`.
 * ⚠️ «Δεν μπόρεσα να ρωτήσω» ⇒ 503, **ποτέ** «δεν έχετε υποθέσεις» (ADR-787 §2.7).
 *
 * @module api/engagements
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { activeWorkspaceOf } from '@/lib/auth/workspace-membership';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { readCaseViewer } from '@/services/conveyance/conveyance-case-viewer.server';
import { listMyCases } from '@/services/conveyance/conveyance-engagement-access.service';

async function handler(request: NextRequest, actor: ApiActor) {
  const viewer = readCaseViewer(request, { uid: actor.ctx.uid, active: activeWorkspaceOf(actor) });
  if ('rejected' in viewer) return viewer.rejected;
  const outcome = await listMyCases(requireAdminFirestore(), viewer, Date.now());
  if (!outcome.ok) return NextResponse.json({ success: false, error: 'ENGAGEMENTS_UNAVAILABLE' }, { status: 503 });
  return apiSuccess({ cards: outcome.cards });
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(handler));
