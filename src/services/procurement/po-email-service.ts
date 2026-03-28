/**
 * PO Email Service — Server-Only
 *
 * Generates PO PDF, wraps in branded email template, sends via Mailgun.
 * Pattern: Same as accounting/invoices/[id]/send-email (ADR-ACC-019).
 *
 * @module services/procurement/po-email-service
 * @enterprise ADR-267 Phase B — Email PO to Supplier
 */

import 'server-only';

import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { wrapInBrandedTemplate } from '@/services/email-templates/base-email-template';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import type { PurchaseOrder } from '@/types/procurement';
import {
  buildPOEmailHtml,
  buildPOEmailSubject,
  type POEmailTemplateConfig,
} from './po-email-template';
import {
  generatePurchaseOrderPdf,
  type POPdfCompanyInfo,
  type POPdfSupplierInfo,
} from './po-pdf-generator';

const logger = createModuleLogger('PO_EMAIL');

// ============================================================================
// TYPES
// ============================================================================

export interface SendPOEmailParams {
  po: PurchaseOrder;
  recipientEmail: string;
  recipientName: string;
  companyInfo: POPdfCompanyInfo;
  supplierInfo: POPdfSupplierInfo;
  language: 'el' | 'en';
  termsAndConditions?: string;
}

export interface SendPOEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// ============================================================================
// SERVICE
// ============================================================================

export async function sendPurchaseOrderEmail(
  params: SendPOEmailParams
): Promise<SendPOEmailResult> {
  const {
    po,
    recipientEmail,
    recipientName,
    companyInfo,
    supplierInfo,
    language,
    termsAndConditions,
  } = params;

  if (!isValidEmail(recipientEmail)) {
    return { success: false, error: 'Invalid recipient email' };
  }

  try {
    // 1. Generate PDF
    const pdfBytes = await generatePurchaseOrderPdf({
      po,
      companyInfo,
      supplierInfo,
      language,
      termsAndConditions,
    });
    const pdfBuffer = Buffer.from(pdfBytes);

    // Safety: enforce 10MB limit
    const PDF_SIZE_LIMIT = 10 * 1024 * 1024;
    if (pdfBuffer.length > PDF_SIZE_LIMIT) {
      return { success: false, error: 'PDF exceeds 10MB limit' };
    }

    // 2. Build email content
    const emailConfig: POEmailTemplateConfig = {
      po,
      recipientName,
      companyName: companyInfo.name,
      language,
    };

    const subject = buildPOEmailSubject(po.poNumber, language);
    const contentHtml = buildPOEmailHtml(emailConfig);
    const htmlBody = wrapInBrandedTemplate({
      contentHtml,
      companyName: companyInfo.name,
      companyPhone: companyInfo.phone,
      companyEmail: companyInfo.email,
      companyAddress: companyInfo.address,
    });

    // 3. Build filename
    const sanitizedSupplier = supplierInfo.name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    const pdfFilename = `${po.poNumber}_${sanitizedSupplier}.pdf`;

    // 4. Send via Mailgun
    const result = await sendReplyViaMailgun({
      to: recipientEmail.trim(),
      subject,
      textBody: `${subject} — ${companyInfo.name}`,
      htmlBody,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    logger.info('PO email sent', {
      poId: po.id,
      poNumber: po.poNumber,
      recipient: recipientEmail,
      success: result.success,
    });

    return {
      success: result.success,
      messageId: result.messageId ?? undefined,
      error: result.error ?? undefined,
    };
  } catch (err) {
    const msg = getErrorMessage(err);
    logger.error('PO email failed', { poId: po.id, error: msg });
    return { success: false, error: msg };
  }
}
