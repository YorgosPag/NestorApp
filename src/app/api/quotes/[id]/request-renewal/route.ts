/**
 * POST /api/quotes/[id]/request-renewal
 *
 * Sends a renewal request email to the vendor for an expired quote.
 * Body: { to: string; subject: string; body: string }
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-328 §5.BB.6 (Phase 10) / Phase 12 wire-up
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('QuoteRenewalRoute');

// ============================================================================
// SCHEMA
// ============================================================================

const RenewalRequestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(10_000),
});

// ============================================================================
// HANDLER
// ============================================================================

async function handlePost(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: quoteId } = await context.params;

  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const parsed = await safeParseBody(req, RenewalRequestSchema);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      const { to, subject, body } = parsed.data;

      const result = await sendReplyViaMailgun({ to, subject, textBody: body });

      if (!result.success) {
        logger.error('Renewal email failed', { quoteId, to, error: result.error });
        return NextResponse.json({ error: result.error ?? 'Send failed' }, { status: 502 });
      }

      logger.info('Renewal email sent', { quoteId, to, messageId: result.messageId });
      return NextResponse.json({ success: true, messageId: result.messageId ?? null });
    },
  );

  return handler(request, context);
}

export const POST = withSensitiveRateLimit(handlePost);
