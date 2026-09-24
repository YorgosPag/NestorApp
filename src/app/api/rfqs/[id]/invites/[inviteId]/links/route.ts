/**
 * GET  /api/rfqs/[id]/invites/[inviteId]/links — the invite's portal links (metadata only)
 * POST /api/rfqs/[id]/invites/[inviteId]/links — issue a NEW link to copy (returned ONCE)
 *
 * ADR-876 §5 — «one link = one credential» (W3C TAG Capability URLs · DocuSign · GitHub). The
 * browser used to read the RAW token from the invite document and build the URL itself (Ε4/Σ2).
 * Now a copy issues a separate, individually revocable credential; nothing that rebuilds a link is
 * ever stored or listed (no hash in the GET).
 *
 * Auth: withAuth | Rate: standard (GET) · sensitive (POST)
 * @see ADR-876 §5
 */

import 'server-only';

import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  issueVendorInviteCopyLink,
  listVendorInviteLinks,
} from '@/subapps/procurement/services/vendor-invite-links-service';
import { inviteRoute } from '../invite-route';

export const GET = withStandardRateLimit(
  inviteRoute((_req, ctx, { id, inviteId }) => listVendorInviteLinks(ctx, id, inviteId)),
);

export const POST = withSensitiveRateLimit(
  inviteRoute((_req, ctx, { id, inviteId }) => issueVendorInviteCopyLink(ctx, id, inviteId)),
);
