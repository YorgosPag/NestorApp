/**
 * @fileoverview **ΠΟΥ ΒΡΙΣΚΕΤΑΙ Η ΣΥΝΑΙΝΕΣΗ ΚΛΕΙΣΤΗΣ ΔΙΑΘΕΣΗΣ** — ανάγνωση για γραφείο και ιδιοκτήτη (ADR-864 §18.4 Δ2).
 * @related services/mandate/private-marketing-panel.service.ts · app/api/owner-properties/[ownerPropertyId]/route.ts
 * @module app/api/owner-properties/[ownerPropertyId]/private-marketing/route
 *
 * 🔑 **Υπο-πόρος, όχι πεδίο της καταχώρησης**: η καταχώρηση φτάνει στον ιδιοκτήτη **ζωντανά** από το Firestore,
 * αλλά η επωνυμία του CAS (`companies`) και η έκδοση σε ισχύ **δεν** διαβάζονται από τον browser. Οι πράξεις
 * μένουν στο `PATCH` της καταχώρησης (`{ privateMarketing }`) — εδώ **μόνο** ανάγνωση.
 *
 * ⚠️ **Ένα σώμα για «δεν υπάρχει» και «δεν είναι δικό σου»** (404 `{ kind: 'absent' }`): αλλιώς η διαδρομή
 * γίνεται μαντείο ύπαρξης αγγελιών άλλων (ίδιο συμβόλαιο με `mandate-detail.service`).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { actorWorkspace, withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type { PrivateMarketingPanels } from '@/lib/mandate/private-marketing-panel';
import { readPrivateMarketingPanels } from '@/services/mandate/private-marketing-panel.service';

type RouteContext = { params: Promise<{ ownerPropertyId: string }> };

type PanelsResponse = PrivateMarketingPanels | { readonly kind: 'absent' };

async function handler(
  _request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse<PanelsResponse>> {
  const ownerPropertyId = (await routeContext?.params)?.ownerPropertyId?.trim() ?? '';
  if (ownerPropertyId === '') return NextResponse.json({ kind: 'absent' } as const, { status: 404 });

  const read = await readPrivateMarketingPanels(
    getAdminFirestore(),
    ownerPropertyId,
    { uid: actor.ctx.uid, companyId: actorWorkspace(actor) },
    nowISO(),
  );
  if (read.kind === 'absent') return NextResponse.json({ kind: 'absent' } as const, { status: 404 });

  const { kind: _found, ...panels } = read;
  return NextResponse.json(panels);
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth<PanelsResponse, RouteContext>(handler));
