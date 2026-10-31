/**
 * @fileoverview **POST /api/supply-invitations/redeem** — ο αγοραστής αποδέχεται ή αρνείται πρόσκληση προμήθειας.
 * @related ADR-923 §5.12 Σ2 · Σ3 · ADR-853 §7.5 · §15 · §20 · πρότυπο `api/engagement-invitations/redeem`
 * @module app/api/supply-invitations/redeem/route
 *
 * 🔴 **ΔΥΟ ΕΛΕΓΧΟΙ ΤΑΥΤΟΤΗΤΑΣ**: υπογεγραμμένο token σε **σώμα** **ΚΑΙ** συνδεδεμένος λογαριασμός με email **του Auth** ίδιο
 * με τον παραλήπτη. 🔑 `withPersonalOrOrgAuth`: ο νεοεγγραμμένος δεν έχει ακόμη οργανισμό, και τότε πρέπει να ακούσει
 * ονομασμένα «χρειάζεστε γραφείο» (`office-required`), όχι 403. Το σύνορο ιδεμποτίας (ADR-872) ισχύει αυτόματα.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { ACTING_WORKSPACE_REQUEST_SCHEMA } from '@/lib/auth/acting-workspace';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { activeWorkspaceOf } from '@/lib/auth/workspace-membership';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  INVITATION_REDEEM_BODY,
  invitationSettledResponse,
  runInvitationPost,
  readInvitationRedeemer,
  type InvitationLinkRefusedBody,
  type InvitationRedeemUnavailableBody,
} from '@/server/invitations/invitation-http';
import { respondToSupplyInvitation, type SupplyInvitationOutcome } from '@/server/supply-relationships/supply-invitation-redeem.server';
import type { SupplyBuyerRefusal } from '@/subapps/catalog/types/supply-invitation';
import type { InvitationCoreRefusal } from '@/types/invitation-core';

const logger = createModuleLogger('SUPPLY_INVITATION_REDEEM');

export const dynamic = 'force-dynamic';

const BODY = INVITATION_REDEEM_BODY.extend({ actingRequest: ACTING_WORKSPACE_REQUEST_SCHEMA.optional() });

type RedeemResponse =
  | { readonly status: 'accepted' }
  | { readonly status: 'declined' }
  | InvitationLinkRefusedBody<InvitationCoreRefusal | SupplyBuyerRefusal>
  | InvitationRedeemUnavailableBody;

function respond(outcome: SupplyInvitationOutcome): NextResponse<RedeemResponse> {
  return outcome.kind === 'accepted' ? NextResponse.json({ status: 'accepted' } as const) : invitationSettledResponse(outcome);
}

function handler(request: NextRequest, actor: ApiActor): Promise<NextResponse<RedeemResponse>> {
  const trace = { logger, message: 'Η εξαργύρωση πρόσκλησης προμήθειας δεν ολοκληρώθηκε', uid: actor.ctx.uid };
  return runInvitationPost(request, BODY, trace, async ({ token, action, actingRequest }) => {
    const identity = await readInvitationRedeemer(actor.ctx.uid);
    const acting = { uid: actor.ctx.uid, active: activeWorkspaceOf(actor), requested: actingRequest ?? null };
    return respond(await respondToSupplyInvitation(getAdminFirestore(), { action, token, identity, acting }));
  });
}

export const POST = withHeavyRateLimit(withPersonalOrOrgAuth<RedeemResponse>(handler));
