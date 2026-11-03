/**
 * `POST /api/communications/email` — το κουμπί «Αποστολή Email» της σελίδας lead.
 *
 * 🔴 **ΕΣΤΕΛΝΕ ΣΕ CLOUD FUNCTION ΠΟΥ ΔΕΝ ΥΠΗΡΞΕ ΠΟΤΕ** (ADR-876 §5.8 Σ22, μετρημένο 2026-11-03):
 * καλούσε το `EMAIL_FUNCTION_URL`, που δεν υπάρχει ούτε στο Coolify ούτε στο `functions/src`
 * ⇒ κάθε αποστολή ήταν `500` πριν φτάσει στο δίκτυο. Πλέον περνά από την **ΕΝΑ** αλυσίδα
 * παρόχων (`defaultEmailChain`) — μετάπτωση, όριο χρόνου, και σε emulator outbox, όχι δίκτυο.
 *
 * @rateLimit STANDARD (60 req/min) - CRUD
 * @see ADR-876 §5.8 Σ22 · ADR-016 (ιστορικό επικοινωνιών lead)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { chainFailureReasons, sendThroughChain } from '@/server/comms/email-provider-chain';
import { defaultEmailChain } from '@/server/comms/email-providers';
import { recordSentEmail } from './record-sent-email';
// Ensure Firebase Admin is initialized
import '@/server/admin/admin-guards';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

const logger = createModuleLogger('EmailRoute');

interface EmailPayload {
  to: string;
  templateId: string;
  subject: string;
  message: string;
  leadId?: string;
  contactId?: string;
  priority?: 'low' | 'normal' | 'high';
  category?: string;
}

interface EmailResponse {
  id?: string;
  status: string;
  message: string;
  production?: boolean;
  messageId?: string;
  error?: string;
}

function errorResponse(status: number, message: string, error: string): NextResponse<EmailResponse> {
  return NextResponse.json({ status: 'error', message, error }, { status });
}

/** Ό,τι γίνεται **μετά** την αποστολή: ίχνος ελέγχου + γραμμή στο ιστορικό της επαφής. */
async function recordDelivery(
  request: NextRequest,
  ctx: AuthContext,
  payload: EmailPayload,
  messageId: string | undefined,
): Promise<void> {
  await logAuditEvent(ctx, 'email_sent', 'communications.email.send', 'api', {
    newValue: { type: 'status', value: { recipient: payload.to, messageId } },
    metadata: extractRequestMetadata(request),
  });
  if (typeof payload.contactId === 'string' && payload.contactId) {
    await recordSentEmail({
      auth: ctx,
      contactId: payload.contactId,
      opportunityId: payload.leadId,
      to: payload.to,
      subject: payload.subject,
      content: payload.message,
      providerMessageId: messageId,
    });
  }
}

async function handleSend(request: NextRequest, ctx: AuthContext): Promise<NextResponse<EmailResponse>> {
  const payload: EmailPayload = await request.json();
  if (!payload.to || !payload.subject || !payload.message) {
    return errorResponse(400, 'Missing required fields', 'Missing required fields: to, subject, message');
  }

  // ADR-857 Φ9 — χωρίς `from`: ο κρίκος ρωτά τη ρίζα ταυτότητας αποστολέα (`resolveSenderHeader`).
  const outcome = await sendThroughChain(defaultEmailChain(), {
    to: payload.to,
    subject: payload.subject,
    text: payload.message,
  });

  if (outcome.kind !== 'delivered') {
    const reason = chainFailureReasons(outcome).join(' | ');
    logger.error('Email not delivered', { outcome: outcome.kind, reason, companyId: ctx.companyId });
    return outcome.kind === 'no-provider'
      ? errorResponse(503, 'Email provider not configured', reason)
      : errorResponse(502, 'Failed to send email', reason);
  }

  logger.info('Email sent', {
    to: payload.to,
    provider: outcome.provider,
    messageId: outcome.messageId,
    companyId: ctx.companyId,
    userId: ctx.uid,
  });
  await recordDelivery(request, ctx, payload, outcome.messageId);

  return NextResponse.json({
    id: outcome.messageId,
    status: 'sent',
    message: 'Email sent successfully',
    production: true,
    messageId: outcome.messageId,
  });
}

/**
 * Send email endpoint - requires authentication and comm:messages:send permission.
 * RFC v6 Authorization: Communications vertical slice.
 */
export const POST = withStandardRateLimit(
  withAuth<EmailResponse>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        return await handleSend(request, ctx);
      } catch (error) {
        logger.error('Error in email API', { error: getErrorMessage(error) });
        return errorResponse(500, 'Internal server error', 'Internal server error');
      }
    },
    { permissions: 'comm:messages:send' },
  ),
);
