/**
 * POST /api/rfqs/[id]/invites/[inviteId]/links/[credentialId]/revoke — revoke ONE portal link.
 *
 * ADR-876 §5 — targeted revocation (W3C TAG Capability URLs): the other links of the invite stay
 * live. Idempotent (already revoked ⇒ success, no second audit entry). Audited.
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-876 §5
 */

import 'server-only';

import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { revokeVendorInviteLink } from '@/subapps/procurement/services/vendor-invite-links-service';
import { inviteRoute, type InviteRouteParams } from '../../../invite-route';

interface LinkRouteParams extends InviteRouteParams {
  readonly credentialId: string;
}

export const POST = withSensitiveRateLimit(
  inviteRoute<LinkRouteParams>((_req, ctx, { id, inviteId, credentialId }) =>
    revokeVendorInviteLink(ctx, id, inviteId, credentialId),
  ),
);
