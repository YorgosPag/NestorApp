/**
 * POST /api/rfqs/[id]/invites/[inviteId]/resend — Re-send the vendor invite email with a NEW link.
 *
 * ADR-876 §5: every resend issues a separate credential (`email_resend`); earlier links stay live
 * until they expire or are revoked one by one. Audited. Invite must belong to THIS RFQ.
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §7 — Phase H · ADR-876 §5
 */

import 'server-only';

import { z } from 'zod';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { resendVendorInvite } from '@/subapps/procurement/services/vendor-invite-links-service';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { inviteRoute } from '../invite-route';

const ResendSchema = z.object({
  locale: z.enum(['el', 'en']).optional(),
});

export const POST = withSensitiveRateLimit(
  inviteRoute(async (req, ctx, { id, inviteId }) => {
    const parsed = safeParseBody(ResendSchema, await req.json().catch(() => ({})));
    if (parsed.error) return parsed.error;
    return resendVendorInvite(ctx, id, inviteId, { locale: parsed.data.locale });
  }),
);
