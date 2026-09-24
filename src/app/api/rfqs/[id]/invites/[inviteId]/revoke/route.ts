/**
 * POST /api/rfqs/[id]/invites/[inviteId]/revoke — Revoke (void) a vendor invite.
 *
 * ADR-876 §5: `status: 'revoked'` (no longer written as `'expired'`) + every live link of the
 * invite revoked in ONE transaction. Only a live invite (pending/sent/opened) can be revoked — a
 * submitted quote is not voided from here (409). Invite must belong to THIS RFQ. Audited.
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §7 — Phase P3.b · ADR-876 §5
 */

import 'server-only';

import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { revokeVendorInvite } from '@/subapps/procurement/services/vendor-invite-service';
import { inviteRoute } from '../invite-route';

export const POST = withSensitiveRateLimit(
  inviteRoute((_req, ctx, { id, inviteId }) => revokeVendorInvite(ctx, id, inviteId)),
);
