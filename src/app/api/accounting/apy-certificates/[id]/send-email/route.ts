/**
 * =============================================================================
 * POST /api/accounting/apy-certificates/[id]/send-email — Send Reminder Email
 * =============================================================================
 *
 * Server-only endpoint that:
 *   1. Fetches the APY certificate from Firestore
 *   2. Generates the PDF server-side (jsPDF — isomorphic)
 *   3. Builds branded HTML email with invoice table + total withholding
 *   4. Sends via Mailgun with PDF attachment
 *   5. Records audit trail (APYEmailSendRecord) via pushAPYEmailRecord()
 *
 * Auth: withAuth (authenticated users)
 * Rate: withSensitiveRateLimit (20 req/min — email is a side-effect)
 *
 * @module api/accounting/apy-certificates/[id]/send-email
 * @enterprise ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import {
  buildAPYEmailContent,
  buildAPYEmailSubject,
  buildAPYEmailPlainText,
} from '@/subapps/accounting/services/email/apy-certificate-email-template';
import type { APYEmailLanguage } from '@/subapps/accounting/services/email/apy-certificate-email-template';
import { wrapInBrandedTemplate } from '@/services/email-templates/base-email-template';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import type { APYEmailSendRecord } from '@/subapps/accounting/types';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('APY_SEND_EMAIL');

// =============================================================================
// VALIDATION
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// =============================================================================
// REQUEST BODY
// =============================================================================

interface SendReminderEmailBody {
  recipientEmail: string;
  subject?: string;
  language?: APYEmailLanguage;
}

// =============================================================================
// HANDLER
// =============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        // ── 1. Parse & validate body ──────────────────────────────────────
        let body: SendReminderEmailBody;
        try {
          body = (await req.json()) as SendReminderEmailBody;
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400 }
          );
        }

        const { recipientEmail, subject: subjectOverride, language: langOverride } = body;

        if (!recipientEmail || !isValidEmail(recipientEmail)) {
          return NextResponse.json(
            { success: false, error: 'Invalid or missing recipientEmail' },
            { status: 400 }
          );
        }

        // ── 2. Fetch APY certificate ──────────────────────────────────────
        const { repository } = createAccountingServices();
        const cert = await repository.getAPYCertificate(id);

        if (!cert) {
          return NextResponse.json(
            { success: false, error: 'APY certificate not found' },
            { status: 404 }
          );
        }

        // ── 3. Generate PDF server-side ───────────────────────────────────
        const { renderAPYCertificatePDF } = await import(
          '@/subapps/accounting/services/pdf/apy-certificate-pdf-template'
        );

        let logoBase64: string | null = null;
        try {
          const { PAGONIS_LOGO_BASE64 } = await import(
            '@/subapps/accounting/services/pdf/logo-data'
          );
          logoBase64 = PAGONIS_LOGO_BASE64;
        } catch {
          // Logo unavailable — PDF renders without it
        }

        const pdf = await renderAPYCertificatePDF({ cert, logoBase64 });

        const pdfArrayBuffer = pdf.output('arraybuffer');
        const pdfBuffer = Buffer.from(pdfArrayBuffer);

        // Safety check: Mailgun limit is 25MB; enforce 10MB
        const PDF_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;
        if (pdfBuffer.length > PDF_SIZE_LIMIT_BYTES) {
          return NextResponse.json(
            { success: false, error: 'Generated PDF exceeds 10MB limit' },
            { status: 422 }
          );
        }

        // ── 4. Build PDF filename ─────────────────────────────────────────
        const sanitizedName = cert.customer.name
          .replace(/[<>:"/\\|?*]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 40);
        const dateCompact = cert.createdAt.substring(0, 10).replace(/-/g, '');
        const pdfFilename = `APY_${cert.fiscalYear}_${sanitizedName}_${dateCompact}.pdf`;

        // ── 5. Build email content ────────────────────────────────────────
        const language: APYEmailLanguage = langOverride ?? 'el';
        const subject = subjectOverride ?? buildAPYEmailSubject(cert, language);
        const textBody = buildAPYEmailPlainText(cert, language);
        const contentHtml = buildAPYEmailContent(cert, language);

        const htmlBody = wrapInBrandedTemplate({
          contentHtml,
          companyName: cert.provider.name,
          companyPhone: cert.provider.phone ?? undefined,
          companyEmail: cert.provider.email ?? undefined,
          companyAddress: cert.provider.address
            ? `${cert.provider.address}, ${cert.provider.city} ${cert.provider.postalCode}`
            : undefined,
        });

        // ── 6. Send via Mailgun ───────────────────────────────────────────
        const mailgunResult = await sendReplyViaMailgun({
          to: recipientEmail.trim(),
          subject,
          textBody,
          htmlBody,
          attachments: [
            {
              filename: pdfFilename,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        });

        // ── 7. Record audit trail ─────────────────────────────────────────
        const emailRecord: APYEmailSendRecord = {
          sentAt: new Date().toISOString(),
          recipientEmail: recipientEmail.trim(),
          subject,
          mailgunMessageId: mailgunResult.messageId ?? null,
          status: mailgunResult.success ? 'sent' : 'failed',
          error: mailgunResult.error ?? null,
        };

        await repository.pushAPYEmailRecord(id, emailRecord);

        logger.info('APY certificate email processed', {
          certificateId: id,
          recipientEmail: recipientEmail.trim(),
          success: mailgunResult.success,
          messageId: mailgunResult.messageId,
        });

        // ── 8. Return result ──────────────────────────────────────────────
        if (!mailgunResult.success) {
          return NextResponse.json(
            {
              success: false,
              error: mailgunResult.error ?? 'Mailgun delivery failed',
            },
            { status: 502 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            mailgunMessageId: mailgunResult.messageId ?? null,
            recipientEmail: recipientEmail.trim(),
            subject,
          },
        });
      } catch (error) {
        const message =
          getErrorMessage(error, 'Failed to send APY certificate email');
        logger.error('APY certificate email endpoint error', { certificateId: id, error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
