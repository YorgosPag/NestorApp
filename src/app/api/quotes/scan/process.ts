/**
 * Quote scan async processor — ADR-327 §6 (Phase 2).
 *
 * Runs after a draft quote + file are persisted. Calls AI analyzer
 * (OpenAIQuoteAnalyzer or stub fallback), writes result via
 * `applyExtractedData`. On failure, marks quote `under_review`
 * with audit note so the user can manually fill in.
 */

import 'server-only';

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { applyExtractedData, updateQuote } from '@/subapps/procurement/services/quote-service';
import { extractAndUploadVendorLogo } from '@/subapps/procurement/services/logo-extractor';
import { dispatchProcurementNotification } from '@/server/notifications/notification-orchestrator';
import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_ENTITY_TYPES } from '@/config/notification-events';
import type { IQuoteAnalyzer } from '@/subapps/procurement/types/quote-analyzer';
import type { AuthContext } from '@/lib/auth';

const logger = createModuleLogger('QUOTE_SCAN_PROCESS');

export async function processScanAsync(
  ctx: AuthContext,
  quoteId: string,
  fileUrl: string,
  mimeType: string,
  analyzer: IQuoteAnalyzer,
  fileBuffer?: Buffer,
): Promise<void> {
  try {
    const classification = await analyzer.classifyQuote(fileUrl, mimeType, fileBuffer);

    if (!classification.isQuote || classification.confidence < 30) {
      logger.warn('Document does not look like a quote', {
        quoteId,
        confidence: classification.confidence,
        language: classification.detectedLanguage,
      });
      await updateQuote(ctx, quoteId, {
        notes: `[AI scan] Δεν αναγνωρίστηκε ως προσφορά (confidence ${classification.confidence}). Ελέγξτε χειροκίνητα.`,
      });
      return;
    }

    const extracted = await analyzer.extractQuote(fileUrl, mimeType, fileBuffer);

    // Extract logo BEFORE applyExtractedData so vendorLogoUrl is included
    // in the single Firestore write — avoids the race where the client reads
    // the quote between applyExtractedData and the subsequent logo patch.
    if (fileBuffer) {
      const logoUrl = await extractAndUploadVendorLogo(fileBuffer, mimeType, ctx.companyId, quoteId);
      if (logoUrl) {
        extracted.vendorLogoUrl = logoUrl;
        logger.info('Vendor logo extracted', { quoteId, logoUrl });
      }
    }

    await applyExtractedData(ctx, quoteId, extracted, { source: 'scan' });

    logger.info('Quote scan completed', {
      quoteId,
      overallConfidence: extracted.overallConfidence,
      lines: extracted.lineItems.length,
    });

    const vendorName = extracted.vendorName?.value ?? quoteId;
    void dispatchProcurementNotification(
      NOTIFICATION_EVENT_TYPES.PROCUREMENT_QUOTE_SCAN_COMPLETED,
      ctx.userId,
      ctx.companyId,
      `Σάρωση προσφοράς ολοκληρώθηκε: ${vendorName}`,
      `quote_scan_${quoteId}`,
      {
        entityId: quoteId,
        entityType: NOTIFICATION_ENTITY_TYPES.QUOTE,
        titleKey: 'quotes:quotes.notifications.quoteScanCompleted',
        titleParams: { vendorName },
      },
    );
  } catch (error) {
    const message = getErrorMessage(error, 'Quote AI scan failed');
    logger.error('Quote scan failed', { quoteId, error: message });
    try {
      await updateQuote(ctx, quoteId, {
        notes: `[AI scan] Σφάλμα ανάλυσης: ${message}. Ελέγξτε χειροκίνητα.`,
      });
    } catch (statusErr) {
      logger.error('Failed to flag quote after scan failure', {
        quoteId,
        error: getErrorMessage(statusErr),
      });
    }
  }
}
