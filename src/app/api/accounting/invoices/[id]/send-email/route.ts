/**
 * =============================================================================
 * POST /api/accounting/invoices/[id]/send-email — Invoice Email Sending
 * =============================================================================
 *
 * Server-only endpoint that:
 *   1. Fetches the invoice from Firestore
 *   2. Generates the PDF server-side (jsPDF — isomorphic)
 *   3. Builds branded HTML email with invoice summary
 *   4. Sends via Mailgun with PDF attachment
 *   5. Records audit trail (EmailSendRecord) in invoice.emailHistory
 *
 * Auth: withAuth (authenticated users)
 * Rate: withSensitiveRateLimit (20 req/min — email is a side-effect)
 *
 * @module api/accounting/invoices/[id]/send-email
 * @enterprise ADR-ACC-019 Invoice Email Sending
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { extractKadFromProfile } from '@/subapps/accounting/services/pdf/invoice-pdf-exporter';
import {
  buildInvoiceEmailContent,
  buildInvoiceEmailSubject,
  buildInvoiceEmailPlainText,
  detectInvoiceEmailLanguage,
} from '@/subapps/accounting/services/email/invoice-email-template';
import {
  wrapInBrandedTemplate,
} from '@/services/email-templates/base-email-template';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import type { EmailSendRecord, UpdateInvoiceInput } from '@/subapps/accounting/types';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { resolveContactDepartmentEmail } from '@/services/org-structure/org-routing-resolver';

const logger = createModuleLogger('INVOICE_EMAIL');

// =============================================================================
// EMAIL VALIDATION
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// =============================================================================
// REQUEST BODY
// =============================================================================

interface SendEmailRequestBody {
  /** Explicit email. If omitted, customerContactId must be provided for L2 cascade. */
  recipientEmail?: string;
  /** Contact ID for L2 org-structure cascade (ADR-326 Phase 6.3). */
  customerContactId?: string;
  subject?: string;
  language?: 'el' | 'en';
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
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        // ── 1. Parse & validate body ──────────────────────────────────────
        let body: SendEmailRequestBody;
        try {
          body = (await req.json()) as SendEmailRequestBody;
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400 }
          );
        }

        const {
          recipientEmail: rawRecipientEmail,
          customerContactId,
          subject: subjectOverride,
          language: langOverride,
        } = body;

        // Cascade: manual email → L2 resolver (accounting dept) → 422 (ADR-326 Phase 6.3)
        let recipientEmail: string;
        let resolvedSource: 'manual' | 'head' | 'backup' | 'dept' = 'manual';

        if (rawRecipientEmail && isValidEmail(rawRecipientEmail)) {
          recipientEmail = rawRecipientEmail;
        } else if (customerContactId) {
          const orgResult = await resolveContactDepartmentEmail(customerContactId, 'accounting');
          if (!orgResult) {
            return NextResponse.json(
              { success: false, error: 'No accounting email found for contact' },
              { status: 422 }
            );
          }
          recipientEmail = orgResult.email;
          resolvedSource = orgResult.source;
        } else {
          return NextResponse.json(
            { success: false, error: 'recipientEmail or customerContactId required' },
            { status: 422 }
          );
        }

        // ── 2. Fetch invoice & company profile ────────────────────────────
        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });

        const [invoice, companyProfile] = await Promise.all([
          repository.getInvoice(id),
          repository.getCompanySetup(),
        ]);

        if (!invoice) {
          return NextResponse.json(
            { success: false, error: 'Invoice not found' },
            { status: 404 }
          );
        }

        // ── 3. Generate PDF server-side ───────────────────────────────────
        const { renderInvoicePDF } = await import(
          '@/subapps/accounting/services/pdf/invoice-pdf-template'
        );

        // Load logo (lazy — returns null if unavailable)
        let logoBase64: string | null = null;
        try {
          const { PAGONIS_LOGO_BASE64 } = await import(
            '@/subapps/accounting/services/pdf/logo-data'
          );
          logoBase64 = PAGONIS_LOGO_BASE64;
        } catch {
          // Logo unavailable — PDF renders without it
        }

        const bankAccounts =
          invoice.issuer.bankAccounts.length > 0
            ? invoice.issuer.bankAccounts
            : [];

        const kadCode = extractKadFromProfile(companyProfile);

        const pdf = await renderInvoicePDF({
          invoice,
          logoBase64,
          bankAccounts,
          kadCode,
          withholdingAmount: 0,
        });

        const pdfArrayBuffer = pdf.output('arraybuffer');
        const pdfBuffer = Buffer.from(pdfArrayBuffer);

        // Safety check: Mailgun limit is 25MB; we enforce 10MB
        const PDF_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;
        if (pdfBuffer.length > PDF_SIZE_LIMIT_BYTES) {
          return NextResponse.json(
            { success: false, error: 'Generated PDF exceeds 10MB limit' },
            { status: 422 }
          );
        }

        // ── 4. Build PDF filename ─────────────────────────────────────────
        const sanitizedCustomer = invoice.customer.name
          .replace(/[<>:"/\\|?*]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);
        const dateCompact = invoice.issueDate.replace(/-/g, '');
        const pdfFilename = `${invoice.series}-${invoice.number}_${sanitizedCustomer}_${dateCompact}.pdf`;

        // ── 5. Build email content ────────────────────────────────────────
        const language = langOverride ?? detectInvoiceEmailLanguage(invoice.customer.country);

        const subject = subjectOverride ?? buildInvoiceEmailSubject(invoice, language);
        const textBody = buildInvoiceEmailPlainText(invoice, language);
        const contentHtml = buildInvoiceEmailContent(invoice, language);

        const htmlBody = wrapInBrandedTemplate({
          contentHtml,
          companyName: invoice.issuer.name,
          companyPhone: invoice.issuer.phone ?? undefined,
          companyEmail: invoice.issuer.email ?? undefined,
          companyAddress: invoice.issuer.address
            ? `${invoice.issuer.address}, ${invoice.issuer.city} ${invoice.issuer.postalCode}`
            : undefined,
          companyWebsite: invoice.issuer.website ?? undefined,
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

        // ── 7. Record audit trail (emailHistory) ──────────────────────────
        const emailRecord: EmailSendRecord = {
          sentAt: nowISO(),
          recipientEmail: recipientEmail.trim(),
          subject,
          mailgunMessageId: mailgunResult.messageId ?? null,
          status: mailgunResult.success ? 'sent' : 'failed',
          error: mailgunResult.error ?? null,
          resolvedSource,
        };

        const updatedEmailHistory: EmailSendRecord[] = [
          ...(invoice.emailHistory ?? []),
          emailRecord,
        ];

        const updatePayload: UpdateInvoiceInput = {
          emailHistory: updatedEmailHistory,
        };

        await repository.updateInvoice(id, updatePayload);

        logger.info('Invoice email processed', {
          invoiceId: id,
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
        const message = getErrorMessage(error, 'Failed to send invoice email');
        logger.error('Invoice email endpoint error', { invoiceId: id, error: message });
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
