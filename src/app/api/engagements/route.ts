/**
 * ADR-901 Φ2 §5.4 · ADR-862 Φ1 — «Οι υποθέσεις μου»: κάθε συμμετοχή του ανθρώπου σε ξένη υπόθεση.
 *
 * GET /api/engagements → `{ cards: MyCaseCard[] }` — μία κάρτα ανά υπόθεση (η τρέχουσα συμμετοχή)
 *
 * 🔑 `withPersonalOrOrgAuth`: ο δικηγόρος μπορεί να είναι ιδιώτης **χωρίς** οργανισμό (ADR-817) ή μέλος
 *    του **δικού του** γραφείου — η λίστα είναι **του ανθρώπου** (`uid` από το token), ποτέ του χώρου.
 *    Καμία παράμετρος από τον πελάτη. Ο οργανισμός του δρώντος **δεν** ρωτιέται καν.
 * ⚠️ «Δεν μπόρεσα να ρωτήσω» ⇒ 503, **ποτέ** «δεν έχετε υποθέσεις» (ADR-787 §2.7).
 *
 * @module api/engagements
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { listMyCases } from '@/services/conveyance/conveyance-engagement-access.service';

async function handler(_request: NextRequest, actor: ApiActor) {
  const outcome = await listMyCases(requireAdminFirestore(), actor.ctx.uid, Date.now());
  if (!outcome.ok) return NextResponse.json({ success: false, error: 'ENGAGEMENTS_UNAVAILABLE' }, { status: 503 });
  return apiSuccess({ cards: outcome.cards });
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(handler));
