/**
 * @fileoverview **POST /api/engagement-invitations/redeem** — ο επαγγελματίας αποδέχεται (με δήλωση ιδιότητας) ή αρνείται.
 * @related ADR-901 Φ3 · §5.3 βήματα 6-9 · Ε-4 · ADR-853 §7.5 · §15 · §20 · πρότυπο `api/spatial-tours/capture-invitations/redeem`
 * @module app/api/engagement-invitations/redeem/route
 *
 * 🔴 **ΔΥΟ ΕΛΕΓΧΟΙ ΤΑΥΤΟΤΗΤΑΣ**: υπογεγραμμένο token (σε **σώμα**, ποτέ σε URL) **ΚΑΙ** συνδεδεμένος λογαριασμός με
 * email **του Auth** ίδιο με τον παραλήπτη — ο κοινός πυρήνας. Άλλο email ⇒ `wrong-recipient` («ζητήστε νέα
 * πρόσκληση»). Η αποδοχή γράφει την **ενεργή** συμμετοχή στην **ίδια** συναλλαγή (δύο κλικ ⇒ μία συμμετοχή).
 *
 * 🔑 **`withPersonalOrOrgAuth`**: ο επαγγελματίας **δεν** είναι μέλος κανενός χώρου του οικοδεσπότη και **δεν** γίνεται
 * ποτέ — καμία γραφή claim (ADR-901 Α1). Ένας νεοεγγραμμένος δεν έχει ακόμη οργανισμό: το `withAuth` θα τον έκοβε.
 * Το σύνορο ιδεμποτίας (ADR-872) ισχύει αυτόματα πίσω από αυτό.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { CREDENTIAL_DECLARATION_SCHEMA } from '@/lib/conveyance/declared-credential';
import { ACTING_WORKSPACE_REQUEST_SCHEMA, actingWorkspaceOf } from '@/lib/auth/acting-workspace';
import type { CaseHome } from '@/lib/conveyance/conveyance-routes';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { activeWorkspaceOf } from '@/lib/auth/workspace-membership';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  respondToEngagementInvitation,
  type EngagementRedeemOutcome,
} from '@/server/engagement-invitations/engagement-invitation-redeem';
import {
  INVITATION_REDEEM_BODY,
  invitationSettledResponse,
  runInvitationPost,
  readInvitationRedeemer,
  type InvitationLinkRefusedBody,
  type InvitationRedeemUnavailableBody,
} from '@/server/invitations/invitation-http';
import type { EngagementInvitationRefusal } from '@/types/engagement-invitation';

const logger = createModuleLogger('ENGAGEMENT_INVITATION_REDEEM');

export const dynamic = 'force-dynamic';

/** Η αποδοχή **χωρίς** δήλωση δεν περνά το σύνορο — η άρνηση δεν τη ζητά. */
const BODY = INVITATION_REDEEM_BODY.extend({
  credential: CREDENTIAL_DECLARATION_SCHEMA.optional(),
  // ADR-901 §15 (Γ1) — το πολύ ΕΝΑ αίτημα χώρου· **αίτημα, όχι άδεια** (το κρίνει ο `decideActingWorkspace`).
  actingRequest: ACTING_WORKSPACE_REQUEST_SCHEMA.optional(),
}).refine(
  (body) => body.action === 'decline' || body.credential !== undefined,
  { message: 'credential required to accept', path: ['credential'] },
);

type RedeemResponse =
  /**
   * Η συμμετοχή που γεννήθηκε **και το σπίτι της** — ο client χτίζει τη διεύθυνση με το typed `myCaseHref`
   * (ADR-901 §5.4 · §15 Γ2). Το `home` είναι **είδος** χώρου, όχι εταιρεία: ό,τι έγραψε ο κριτής στην αποδοχή.
   */
  | { readonly status: 'accepted'; readonly engagementId: string; readonly home: CaseHome }
  | { readonly status: 'declined' }
  | InvitationLinkRefusedBody<EngagementInvitationRefusal>
  | InvitationRedeemUnavailableBody;

/** **Έκβαση → HTTP**: η αποδοχή λέει τη συμμετοχή και το σπίτι της, τα υπόλοιπα είναι κοινά. */
function respond(outcome: EngagementRedeemOutcome): NextResponse<RedeemResponse> {
  if (outcome.kind !== 'accepted') return invitationSettledResponse(outcome);
  return NextResponse.json({ status: 'accepted', engagementId: outcome.effect.id, home: actingWorkspaceOf(outcome.effect).kind } as const);
}

function handler(request: NextRequest, actor: ApiActor): Promise<NextResponse<RedeemResponse>> {
  const trace = { logger, message: 'Η εξαργύρωση πρόσκλησης υπόθεσης δεν ολοκληρώθηκε', uid: actor.ctx.uid };
  return runInvitationPost(request, BODY, trace, async ({ token, action, credential, actingRequest }) => {
    // 🔴 §15 — ο λογαριασμός **από το Auth**, ποτέ από το token.
    const identity = await readInvitationRedeemer(actor.ctx.uid);
    // §15 — ο χώρος γραφείου έρχεται από το **token** του αιτήματος· ό,τι ζήτησε ο άνθρωπος ταξιδεύει ως αίτημα.
    const acting = { active: activeWorkspaceOf(actor), requested: actingRequest ?? null };
    const outcome = action === 'accept' && credential
      ? await respondToEngagementInvitation(getAdminFirestore(), { action, token, identity, credential, acting })
      : await respondToEngagementInvitation(getAdminFirestore(), { action: 'decline', token, identity });
    return respond(outcome);
  });
}

export const POST = withHeavyRateLimit(withPersonalOrOrgAuth<RedeemResponse>(handler));
