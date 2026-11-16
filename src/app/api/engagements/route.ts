/**
 * ADR-901 Φ2 §5.4 · §15 Γ2 · ADR-862 Φ1 — «Οι υποθέσεις μου»: οι συμμετοχές του ανθρώπου σε ξένες υποθέσεις.
 *
 * GET /api/engagements?home=org|personal → `{ cards: MyEngagementCard[] }` — μία κάρτα ανά υπόθεση (η τρέχουσα
 *   συμμετοχή), **κάθε είδους**: μεταβίβαση και ανάθεση έκδοσης στην ίδια λίστα (ADR-862 §5.3.11)
 *
 * 🔑 `withPersonalOrOrgAuth`: ο δικηγόρος μπορεί να είναι ιδιώτης **χωρίς** οργανισμό (ADR-817) ή μέλος
 *    του **δικού του** γραφείου — η λίστα είναι **του ανθρώπου** (`uid` από το token).
 * 🔑 §15 Γ2 (Α6) — **μία λίστα, φίλτρο ο χώρος της σελίδας**: `home=org` ⇒ όσες ενεργούν για το γραφείο του
 *    αιτήματος· `home=personal` ⇒ όσες ζουν στον προσωπικό χώρο· οι προτάσεις που περιμένουν απάντηση ⇒ παντού.
 *    Η παράμετρος δηλώνει **είδος**, ποτέ εταιρεία: την ταυτότητα του γραφείου τη δίνει ο **κριμένος** χώρος του
 *    αιτήματος (`activeWorkspaceOf`). Στενεύει, δεν ανοίγει — το «ποιος βλέπει» μένει `decideEngagement`.
 * 🔑 ADR-915 §45.19 Φ6β — η πλήρης απάντηση φέρει και `openItems` (οι εκκρεμότητές του από **όλα** τα γραφεία,
 *    `null` = δεν διαβάστηκαν)· `?view=open-items` ⇒ **μόνο** `{ openItems }` (ημερολόγιο CRM), χωρίς χώρο σελίδας:
 *    η λίστα είναι του ανθρώπου (`uid`), ενοποιημένη.
 * ⚠️ «Δεν μπόρεσα να ρωτήσω» ⇒ 503, **ποτέ** «δεν έχετε υποθέσεις» (ADR-787 §2.7).
 *
 * @module api/engagements
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { activeWorkspaceOf } from '@/lib/auth/workspace-membership';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { readQueryParams } from '@/lib/api/query-params';
import { ENGAGEMENTS_VIEW_PARAM, ENGAGEMENTS_VIEWS } from '@/lib/conveyance/conveyance-routes';
import { readCaseViewer } from '@/services/conveyance/conveyance-case-viewer.server';
import { listMyEngagements, listMyOpenItems } from '@/server/engagements/my-engagements.server';

const ENGAGEMENTS_VIEW_QUERY = z.object({ [ENGAGEMENTS_VIEW_PARAM]: z.enum(ENGAGEMENTS_VIEWS).optional() });

function unavailable() {
  return NextResponse.json({ success: false, error: 'ENGAGEMENTS_UNAVAILABLE' }, { status: 503 });
}

async function handler(request: NextRequest, actor: ApiActor) {
  const query = readQueryParams(request, ENGAGEMENTS_VIEW_QUERY);
  if ('rejected' in query) return query.rejected;
  if (query.data[ENGAGEMENTS_VIEW_PARAM] === 'open-items') {
    const items = await listMyOpenItems(requireAdminFirestore(), actor.ctx.uid, Date.now());
    return items.ok ? apiSuccess({ openItems: items.openItems }) : unavailable();
  }
  const viewer = readCaseViewer(request, { uid: actor.ctx.uid, active: activeWorkspaceOf(actor) });
  if ('rejected' in viewer) return viewer.rejected;
  const outcome = await listMyEngagements(requireAdminFirestore(), viewer, Date.now());
  if (!outcome.ok) return unavailable();
  return apiSuccess({ cards: outcome.cards, openItems: outcome.openItems });
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(handler));
