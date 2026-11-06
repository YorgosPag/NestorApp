/**
 * GET  /api/opportunities/[id]/owner → { ownerUid, candidates }
 * POST /api/opportunities/[id]/owner  { expectedOwnerUid, newOwnerUid, note? } → { outcome, ownerUid, previousOwnerUid? }
 *
 * The ONE door for an opportunity's owner (ADR-930 §3.8) — Salesforce «Change Owner» · Pipedrive «Change a deal's
 * owner» · HubSpot «Deal owner», plus:
 * - `expectedOwnerUid` ≠ stored owner ⇒ 409 `{ currentOwnerUid }` — someone else transferred it meanwhile (CAS; the
 *   big three are last-write-wins). Same owner again ⇒ `unchanged`: no write, no history row, no notification.
 * - The new owner must be an ACTIVE member of the opportunity's workspace ⇒ otherwise 400 `owner_not_member`.
 * - Optional hand-off note (≤ 500) reaches the new owner in the notification and stays in the history.
 *
 * Candidates (GET) are the SAME list the POST validates against: the active members of the workspace, with names
 * from the one person reader (`readNetworkPeople`). The current owner is always included so the name shows.
 *
 * Auth: withAuth + tenant fence (foreign ⇒ 404) + **owner authority** (`requireOpportunityAccess`, intent `transfer`):
 *   manager capability `crm:opportunities:update` ⇒ every opportunity · current owner ⇒ their own. Refused ⇒ 403
 *   `{ reason, ownerUid }`. GET uses the same intent: only someone who can transfer needs the member list (GDPR
 *   minimisation — everyone else sees the owner's name through `useUserDisplayNames`).
 * Rate: sensitive (CRM data)
 *
 * @see ADR-930 §3.8 · ADR-602 API Route-Handler Factory SSoT
 */

import 'server-only';

import type { z } from 'zod';

import { badRequest, conflict, defineRoute, ok } from '@/lib/api/define-route';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { API_ROUTES } from '@/config/domain-constants';
import { listActiveWorkspaceMembers } from '@/lib/auth/workspace-membership';
import { opportunityOwnerOf } from '@/services/crm/opportunity-access';
import { requireOpportunityAccess } from '@/services/crm/opportunity-access.server';
import {
  opportunityOwnerBody,
  type OpportunityOwnerCandidatesResponse,
  type OpportunityOwnerTransferResponse,
} from '@/services/crm/opportunity-owner-schema';
import { applyOpportunityOwnerTransfer } from '@/services/crm/opportunity-owner-transfer.server';
import { readNetworkPeople } from '@/services/network-messaging/thread-people';

export const dynamic = 'force-dynamic';

type Params = { id: string };

export const GET = defineRoute<z.ZodTypeAny, Params>({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to load opportunity owner candidates',
  handler: async ({ auth, params }) => {
    const opportunity = await requireOpportunityAccess({ ctx: auth, opportunityId: params.id, path: API_ROUTES.OPPORTUNITIES.OWNER(params.id), intent: 'transfer' });
    const db = getAdminFirestore();
    const ownerUid = opportunityOwnerOf(opportunity);
    const members = await listActiveWorkspaceMembers(db, opportunity.companyId);
    const uids = [...new Set([...(ownerUid ? [ownerUid] : []), ...members.map((member) => member.uid)])];
    const response: OpportunityOwnerCandidatesResponse = { ownerUid, candidates: await readNetworkPeople(db, uids) };
    return ok(response);
  },
});

export const POST = defineRoute<typeof opportunityOwnerBody, Params>({
  rateLimit: 'sensitive',
  schema: opportunityOwnerBody,
  fallbackError: 'Failed to transfer opportunity',
  handler: async ({ auth, body, params }) => {
    await requireOpportunityAccess({ ctx: auth, opportunityId: params.id, path: API_ROUTES.OPPORTUNITIES.OWNER(params.id), intent: 'transfer' });
    const outcome = await applyOpportunityOwnerTransfer(getAdminFirestore(), { opportunityId: params.id, request: body, ctx: auth });
    if (outcome.kind === 'conflict') conflict('Opportunity owner changed meanwhile', { currentOwnerUid: outcome.currentOwnerUid });
    if (outcome.kind === 'invalid') badRequest('Invalid owner transfer', { reason: outcome.reason });
    const response: OpportunityOwnerTransferResponse =
      outcome.kind === 'unchanged'
        ? { outcome: 'unchanged', ownerUid: outcome.ownerUid }
        : { outcome: 'applied', ownerUid: outcome.ownerUid, previousOwnerUid: outcome.previousOwnerUid };
    return ok(response);
  },
});
