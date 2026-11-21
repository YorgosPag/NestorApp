/**
 * POST /api/rfqs/[id]/invites/preview — Το email πρόσκλησης όπως θα το λάβει ο παραλήπτης, ΠΡΙΝ σταλεί.
 *
 * Ίδιος builder + composer με την αποστολή (ADR-327 §7.5) ⇒ η προεπισκόπηση της φόρμας είναι πανομοιότυπη με το
 * email. Καμία εγγραφή, κανένα διαπιστευτήριο, καμία κατανάλωση ορίου (`vendor-invite-preview.ts`).
 *
 * Auth: withAuth | Rate: standard (η φόρμα ζητά με debounce, όχι σε κάθε πλήκτρο)
 * @see ADR-327 §7.5
 */

import 'server-only';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { previewVendorInvite } from '@/subapps/procurement/services/vendor-invite-preview';
import { rfqIdRoute } from '../../../_shared/rfq-id-route';
import { InviteMessageFields } from '../../../_shared/invite-message-schema';

const PreviewRecipientSchema = z.union([
  z.object({ vendorContactId: z.string().min(1) }),
  z.object({ manualEmail: z.string().email(), manualName: z.string().optional() }),
]);

const PreviewSchema = z.object({
  recipient: PreviewRecipientSchema,
  ...InviteMessageFields,
});

const handlePost = rfqIdRoute({
  run: async ({ req, ctx, id }) => {
    const parsed = safeParseBody(PreviewSchema, await req.json().catch(() => ({})));
    if (parsed.error) return parsed.error;
    const { recipient, expiresOn, buyerNote, locale } = parsed.data;
    const preview = await previewVendorInvite(ctx, id, { recipient, expiresOn, buyerNote, locale });
    return NextResponse.json({ success: true, data: preview });
  },
});

export const POST = withStandardRateLimit(handlePost);
