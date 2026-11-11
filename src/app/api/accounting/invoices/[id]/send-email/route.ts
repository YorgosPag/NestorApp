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
 *   6. ADR-ACC-018 §16: mints the invoice's payment link (body button + attached PDF); revoked if delivery fails
 *
 * Auth: withAuth (authenticated users)
 * Rate: withSensitiveRateLimit (20 req/min — email is a side-effect)
 *
 * @module api/accounting/invoices/[id]/send-email
 * @enterprise ADR-ACC-019 Invoice Email Sending
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
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
import { nowISO } from '@/lib/date-local';
import { resolveContactDepartmentEmail } from '@/services/org-structure/org-routing-resolver';
import { hasLivePaymentAccounts, withCurrentPaymentAccounts } from '../../invoice-payment-snapshot';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  mintInvoiceEmailPaymentLink,
  revokeInvoiceEmailPaymentLink,
} from '@/server/accounting/public-invoice/invoice-email-payment-link';

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
// POST — Send Invoice Email
// =============================================================================

export const POST = defineRoute({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to send invoice email',
  handler: async ({ req, auth, params }) => {
    const { id } = params;

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
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    const [stored, companyProfile] = await Promise.all([
      repository.getInvoice(id),
      repository.getCompanySetup(),
    ]);

    if (!stored) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // ADR-ACC-018 §15.2: πρόχειρο ⇒ ο πελάτης παίρνει τους λογαριασμούς του σημερινού μητρώου, όχι της δημιουργίας.
    const invoice = await withCurrentPaymentAccounts(repository, stored);

    // ── 3. Payment link (ADR-ACC-018 §16) + PDF server-side ───────────
    const db = getAdminFirestore();
    const creator = { uid: auth.uid, companyId: auth.companyId };
    const paymentLink = await mintInvoiceEmailPaymentLink(db, creator, invoice, recipientEmail.trim());

    const pdfDocument = await import('@/subapps/accounting/services/pdf/invoice-pdf-document');
    const pdf = await pdfDocument.renderInvoicePdfDocument({
      invoice,
      kadCode: pdfDocument.extractKadFromProfile(companyProfile),
      paymentPageUrl: paymentLink?.url ?? null,
    });

    const pdfArrayBuffer = pdf.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    // Safety check: Mailgun limit is 25MB; we enforce 10MB
    const PDF_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;
    if (pdfBuffer.length > PDF_SIZE_LIMIT_BYTES) {
      if (paymentLink !== null) await revokeInvoiceEmailPaymentLink(db, creator, paymentLink.shareId);
      return NextResponse.json(
        { success: false, error: 'Generated PDF exceeds 10MB limit' },
        { status: 422 }
      );
    }

    // ── 4. Build PDF filename ─────────────────────────────────────────
    const pdfFilename = pdfDocument.invoicePdfFilename(invoice);

    // ── 5. Build email content ────────────────────────────────────────
    const language = langOverride ?? detectInvoiceEmailLanguage(invoice.customer.country);

    const subject = subjectOverride ?? buildInvoiceEmailSubject(invoice, language);
    const textBody = buildInvoiceEmailPlainText(invoice, language, paymentLink?.url ?? null);
    const contentHtml = buildInvoiceEmailContent(invoice, language, paymentLink?.url ?? null);

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
      paymentLinkShareId: paymentLink?.shareId ?? null,
    };

    const updatedEmailHistory: EmailSendRecord[] = [
      ...(invoice.emailHistory ?? []),
      emailRecord,
    ];

    const updatePayload: UpdateInvoiceInput = {
      emailHistory: updatedEmailHistory,
      // Ό,τι έφτασε στον πελάτη μένει και στο έγγραφο — μόνο σε πρόχειρο· το στιγμιότυπο εκδομένου δεν αγγίζεται ποτέ.
      ...(mailgunResult.success && hasLivePaymentAccounts(stored) && { issuer: invoice.issuer }),
    };

    await repository.updateInvoice(id, updatePayload);
    // Το email δεν έφυγε ⇒ κανείς δεν έλαβε τον σύνδεσμο ⇒ ανάκληση (ADR-ACC-018 §16).
    if (!mailgunResult.success && paymentLink !== null) {
      await revokeInvoiceEmailPaymentLink(db, creator, paymentLink.shareId);
    }

    logger.info('Invoice email processed', {
      invoiceId: id,
      recipientEmail: recipientEmail.trim(),
      success: mailgunResult.success,
      messageId: mailgunResult.messageId,
      // The provider's text (configuration, upstream body) stays HERE — never on the wire (ADR-603 §Ασπίδα).
      ...(mailgunResult.success ? {} : { error: mailgunResult.error ?? null }),
    });

    // ── 8. Return result ──────────────────────────────────────────────
    if (!mailgunResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Mailgun delivery failed',
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
  },
});
