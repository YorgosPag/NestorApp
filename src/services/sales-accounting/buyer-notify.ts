/**
 * @fileoverview Buyer email notifications (ADR-198)
 * @description Sends branded HTML confirmation emails to buyers for
 *              reservation, cancellation, and sale events.
 * @pattern Fire-and-forget — does not block the sales flow
 */

import 'server-only';

import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import {
  buildReservationConfirmationEmail,
  buildCancellationConfirmationEmail,
  buildSaleConfirmationEmail,
} from '@/services/email-templates';
import { getErrorMessage } from '@/lib/error-utils';
import type { SalesAccountingEvent, SalesAccountingResult } from './types';

// ============================================================================
// BUYER — RESERVATION CONFIRMATION
// ============================================================================

/**
 * Στέλνει branded HTML email επιβεβαίωσης κράτησης στον αγοραστή.
 *
 * Fire-and-forget: αν αποτύχει, δεν επηρεάζει τη ροή πώλησης.
 * Στέλνεται ΜΟΝΟ αν ο αγοραστής έχει email.
 * Χρησιμοποιεί το κεντρικοποιημένο email template system (Pagonis Energo branding).
 */
export async function notifyBuyerReservation(
  event: SalesAccountingEvent & { eventType: 'deposit_invoice' | 'reservation_notify' },
  result: SalesAccountingResult | null,
  buyerEmail: string,
  buyerName: string
): Promise<void> {
  if (result !== null && !result.success) {
    console.log('[Buyer Notify] Skipping — invoice creation failed');
    return;
  }

  console.log(`[Buyer Notify] Sending branded reservation confirmation to ${buyerEmail}`);

  try {
    const invoiceRef = result?.invoiceNumber ? `A-${result.invoiceNumber}` : null;
    const { subject, html, text } = buildReservationConfirmationEmail({
      buyerName,
      unitName: event.propertyName,
      unitFloor: event.unitFloor,
      buildingName: event.buildingName,
      projectName: event.projectName,
      projectAddress: event.projectAddress,
      companyName: event.companyName,
      depositAmount: event.depositAmount,
      paymentMethod: event.paymentMethod,
      invoiceRef,
    });

    const mailResult = await sendReplyViaMailgun({
      to: buyerEmail,
      subject,
      textBody: text,
      htmlBody: html,
    });

    if (mailResult.success) {
      console.log(`[Buyer Notify] Branded email sent — messageId: ${mailResult.messageId}`);
    } else {
      console.warn(`[Buyer Notify] Mailgun error: ${mailResult.error}`);
    }
  } catch (err) {
    const msg = getErrorMessage(err);
    console.warn(`[Buyer Notify] Failed to send buyer email: ${msg}`);
  }
}

// ============================================================================
// BUYER — CANCELLATION CONFIRMATION
// ============================================================================

/**
 * Στέλνει branded HTML email ειδοποίησης ακύρωσης στον αγοραστή.
 *
 * Fire-and-forget: αν αποτύχει, δεν επηρεάζει τη ροή ακύρωσης.
 * Στέλνεται ΜΟΝΟ αν ο αγοραστής έχει email.
 */
export async function notifyBuyerCancellation(
  event: SalesAccountingEvent & { eventType: 'credit_invoice' },
  result: SalesAccountingResult,
  buyerEmail: string,
  buyerName: string
): Promise<void> {
  if (!result.success) {
    console.log('[Buyer Notify] Skipping cancellation — credit invoice creation failed');
    return;
  }

  console.log(`[Buyer Notify] Sending branded cancellation confirmation to ${buyerEmail}`);

  try {
    const creditNoteRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : null;
    const { subject, html, text } = buildCancellationConfirmationEmail({
      buyerName,
      unitName: event.propertyName,
      unitFloor: event.unitFloor,
      buildingName: event.buildingName,
      projectName: event.projectName,
      projectAddress: event.projectAddress,
      companyName: event.companyName,
      creditAmount: event.creditAmount,
      paymentMethod: event.paymentMethod,
      reason: event.reason,
      creditNoteRef,
    });

    const mailResult = await sendReplyViaMailgun({
      to: buyerEmail,
      subject,
      textBody: text,
      htmlBody: html,
    });

    if (mailResult.success) {
      console.log(`[Buyer Notify] Cancellation email sent — messageId: ${mailResult.messageId}`);
    } else {
      console.warn(`[Buyer Notify] Mailgun cancellation error: ${mailResult.error}`);
    }
  } catch (err) {
    const msg = getErrorMessage(err);
    console.warn(`[Buyer Notify] Failed to send cancellation email: ${msg}`);
  }
}

// ============================================================================
// BUYER — SALE CONFIRMATION
// ============================================================================

/**
 * Στέλνει branded HTML email επιβεβαίωσης πώλησης στον αγοραστή.
 *
 * Fire-and-forget: αν αποτύχει, δεν επηρεάζει τη ροή πώλησης.
 * Στέλνεται ΜΟΝΟ αν ο αγοραστής έχει email.
 */
export async function notifyBuyerSale(
  event: SalesAccountingEvent & { eventType: 'final_sale_invoice' },
  result: SalesAccountingResult,
  buyerEmail: string,
  buyerName: string
): Promise<void> {
  if (!result.success) {
    console.log('[Buyer Notify] Skipping sale — invoice creation failed');
    return;
  }

  console.log(`[Buyer Notify] Sending branded sale confirmation to ${buyerEmail}`);

  try {
    const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : null;
    const { subject, html, text } = buildSaleConfirmationEmail({
      buyerName,
      unitName: event.propertyName,
      unitFloor: event.unitFloor,
      buildingName: event.buildingName,
      projectName: event.projectName,
      projectAddress: event.projectAddress,
      companyName: event.companyName,
      finalPrice: event.finalPrice,
      depositAlreadyInvoiced: event.depositAlreadyInvoiced,
      paymentMethod: event.paymentMethod,
      invoiceRef,
    });

    const mailResult = await sendReplyViaMailgun({
      to: buyerEmail,
      subject,
      textBody: text,
      htmlBody: html,
    });

    if (mailResult.success) {
      console.log(`[Buyer Notify] Sale email sent — messageId: ${mailResult.messageId}`);
    } else {
      console.warn(`[Buyer Notify] Mailgun sale error: ${mailResult.error}`);
    }
  } catch (err) {
    const msg = getErrorMessage(err);
    console.warn(`[Buyer Notify] Failed to send sale email: ${msg}`);
  }
}
