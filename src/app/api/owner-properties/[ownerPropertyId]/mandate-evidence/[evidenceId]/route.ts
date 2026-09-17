/**
 * @fileoverview **ΛΗΨΗ ΠΑΓΩΜΕΝΟΥ ΑΠΟΔΕΙΚΤΙΚΟΥ ΜΕ ΛΟΓΑΡΙΑΣΜΟ** — ιδιοκτήτης ή γραφείο (ADR-864 §19 · Α33-Α34).
 * @related services/mandate/mandate-evidence-access.ts · app/api/owner-properties/[ownerPropertyId]/private-marketing/route.ts
 * @module app/api/owner-properties/[ownerPropertyId]/mandate-evidence/[evidenceId]/route
 *
 * 🔑 **Ποιος είναι ο δρων το αποφασίζει η καταχώρηση, όχι το αίτημα**: ιδιοκτήτης **μόνο** σε προσωπική
 * καταχώρηση που διαχειρίζεται· αλλιώς γραφείο (ίδια διατύπωση με τον αναγνώστη πάνελ — `consentActorOf`).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { actorWorkspace, withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { consentActorOfProperty } from '@/services/mandate/private-marketing-actor';
import { openMandateEvidence } from '@/services/mandate/mandate-evidence-access';

import { respondToEvidenceDownload } from '../../../_shared/evidence-download-response';

type RouteContext = { params: Promise<{ ownerPropertyId: string; evidenceId: string }> };

async function handler(_request: NextRequest, actor: ApiActor, routeContext?: RouteContext): Promise<NextResponse> {
  const params = await routeContext?.params;
  const ownerPropertyId = decodeRouteParam(params?.ownerPropertyId ?? '').trim();
  const evidenceId = decodeRouteParam(params?.evidenceId ?? '').trim();
  if (ownerPropertyId === '' || evidenceId === '') return respondToEvidenceDownload({ kind: 'absent' });

  const listingActor = { uid: actor.ctx.uid, companyId: actorWorkspace(actor) };
  return respondToEvidenceDownload(
    await openMandateEvidence(getAdminFirestore(), {
      ownerPropertyId,
      who: (property) => consentActorOfProperty(property, listingActor),
      evidenceId,
    }),
  );
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth<unknown, RouteContext>(handler));
