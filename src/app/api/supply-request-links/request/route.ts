/**
 * @fileoverview **POST /api/supply-request-links/request** — ο αγοραστής ζητά σύνδεση με σύνδεσμο/QR (ADR-923 §5.12 Σ2 πόρτα β).
 * @related ADR-923 §5.12 Σ3 · πρότυπο `api/engagement-invitations/redeem`
 * @module app/api/supply-request-links/request/route
 *
 * 🔑 Ο σύνδεσμος δίνει **μόνο το δικαίωμα να ζητήσεις**: τίποτα δεν ανοίγει χωρίς έγκριση του προμηθευτή. Ο αριθμός πελάτη
 * είναι αυτοδήλωση και τον κρίνει εκείνος. Βαρύ όριο: η διαδρομή δέχεται όποιον κρατά έναν σύνδεσμο τυπωμένο σε χαρτί.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { activeWorkspaceOf } from '@/lib/auth/workspace-membership';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  invitationSettledResponse,
  runInvitationPost,
  type InvitationLinkRefusedBody,
  type InvitationRedeemUnavailableBody,
} from '@/server/invitations/invitation-http';
import { requestSupplyAccess, type SupplyAccessRequestOutcome } from '@/server/supply-relationships/supply-request-link.server';
import { supplyAccessRequestBodySchema } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import type { SupplyBuyerRefusal } from '@/subapps/catalog/types/supply-invitation';
import type { InvitationCoreRefusal } from '@/types/invitation-core';

const logger = createModuleLogger('SUPPLY_ACCESS_REQUEST');

export const dynamic = 'force-dynamic';

type RequestResponse =
  | { readonly status: 'requested' }
  | { readonly status: 'declined' }
  | InvitationLinkRefusedBody<InvitationCoreRefusal | SupplyBuyerRefusal>
  | InvitationRedeemUnavailableBody;

function respond(outcome: SupplyAccessRequestOutcome): NextResponse<RequestResponse> {
  return outcome.kind === 'requested' ? NextResponse.json({ status: 'requested' } as const) : invitationSettledResponse(outcome);
}

function handler(request: NextRequest, actor: ApiActor): Promise<NextResponse<RequestResponse>> {
  const trace = { logger, message: 'Το αίτημα σύνδεσης με προμηθευτή δεν ολοκληρώθηκε', uid: actor.ctx.uid };
  return runInvitationPost(request, supplyAccessRequestBodySchema, trace, async ({ token, customerRef, actingRequest }) => {
    const acting = { uid: actor.ctx.uid, active: activeWorkspaceOf(actor), requested: actingRequest ?? null };
    return respond(await requestSupplyAccess(getAdminFirestore(), { token, customerRef, acting }));
  });
}

export const POST = withHeavyRateLimit(withPersonalOrOrgAuth<RequestResponse>(handler));
