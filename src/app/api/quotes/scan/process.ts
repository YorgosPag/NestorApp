/**
 * Quote scan async processor — ADR-327 §6 (Phase 2) · §6.10 (κύκλος ζωής).
 *
 * Runs after a quote + file are persisted and `extraction.status = 'pending'` is written (by `createQuote` on the
 * first scan, by `markQuoteExtractionPending` on a retry). Classifies + extracts, then ends the attempt:
 *   - success        → `applyExtractedData` (data + `succeeded` in ONE write)
 *   - not a quote    → `failed` / `not_a_quote`
 *   - any error      → `failed` / `analyzer_failed`
 * Failures carry a CODE, never prose: the human text comes from the client's i18n (N.11). Before §6.10 this file
 * wrote raw Greek into `notes` and never touched the status — the review screen spun forever.
 */

import 'server-only';

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { applyExtractedData } from '@/subapps/procurement/services/quote-service';
import { markQuoteExtractionFailed } from '@/subapps/procurement/services/quote-extraction-lifecycle';
import { extractAndUploadVendorLogo } from '@/subapps/procurement/services/logo-extractor';
import { createOpenAIQuoteAnalyzer } from '@/subapps/procurement/services/external/openai-quote-analyzer';
import { QuoteAnalyzerStub } from '@/subapps/procurement/services/external/quote-analyzer.stub';
import { dispatchProcurementNotification } from '@/server/notifications/notification-orchestrator';
import { notificationFallbackTitle } from '@/server/notifications/notification-title';
import { vendorNotificationTitle } from '@/subapps/procurement/utils/quote-vendor-identity';
import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_ENTITY_TYPES } from '@/config/notification-events';
import type { IQuoteAnalyzer } from '@/subapps/procurement/types/quote-analyzer';
import type { QuoteExtractionErrorCode } from '@/subapps/procurement/types/quote';
import type { AuthContext } from '@/lib/auth';

const logger = createModuleLogger('QUOTE_SCAN_PROCESS');

/** Κάτω από αυτό ο ταξινομητής δεν πείθει ότι είναι προσφορά. */
const MIN_QUOTE_CONFIDENCE = 30;

/** Ο αναλυτής της σάρωσης — ΕΝΑ σημείο για πρώτη σάρωση και επανάληψη (OpenAI, ή stub χωρίς κλειδί). */
export function resolveQuoteAnalyzer(): IQuoteAnalyzer {
  return createOpenAIQuoteAnalyzer() ?? new QuoteAnalyzerStub();
}

export interface ScanJob {
  readonly quoteId: string;
  readonly fileUrl: string;
  readonly mimeType: string;
  /** Τα bytes, όταν τα έχει ήδη ο καλών — αποφεύγει δεύτερη λήψη μέσα στο `after()`. */
  readonly fileBuffer?: Buffer;
  /** Ο αριθμός της προσπάθειας (fencing token, `quote-extraction-lifecycle`). */
  readonly attempt: number;
}

async function failAttempt(ctx: AuthContext, job: ScanJob, errorCode: QuoteExtractionErrorCode): Promise<void> {
  try {
    await markQuoteExtractionFailed(ctx, job.quoteId, errorCode, job.attempt);
  } catch (markErr) {
    // Η σήμανση χάθηκε ⇒ μένει `pending` ⇒ ο κριτής τη δείχνει «κόλλησε» μετά το όριο, με επανάληψη.
    logger.error('Failed to record extraction failure', { quoteId: job.quoteId, error: getErrorMessage(markErr) });
  }
}

function notifyScanCompleted(ctx: AuthContext, quoteId: string, vendorName: string | null | undefined): void {
  // ADR-327: ποτέ ωμό `quoteId` ως «όνομα» (ήταν `?? quoteId`)· ο τίτλος από ΕΝΑ κλειδί, όχι δεύτερο ελληνικό κείμενο.
  const title = vendorNotificationTitle(vendorName, {
    known: 'common-shared:quoteNotifications.quoteScanCompleted',
    unknown: 'common-shared:quoteNotifications.quoteScanCompletedUnknownVendor',
  });
  void dispatchProcurementNotification(
    NOTIFICATION_EVENT_TYPES.PROCUREMENT_QUOTE_SCAN_COMPLETED,
    ctx.uid,
    ctx.companyId,
    notificationFallbackTitle(title.titleKey, title.titleParams),
    `quote_scan_${quoteId}`,
    { entityId: quoteId, entityType: NOTIFICATION_ENTITY_TYPES.QUOTE, ...title },
  );
}

export async function processScanAsync(ctx: AuthContext, job: ScanJob, analyzer: IQuoteAnalyzer): Promise<void> {
  const { quoteId, fileUrl, mimeType, fileBuffer } = job;
  try {
    const classification = await analyzer.classifyQuote(fileUrl, mimeType, fileBuffer);
    if (!classification.isQuote || classification.confidence < MIN_QUOTE_CONFIDENCE) {
      logger.warn('Document does not look like a quote', {
        quoteId, confidence: classification.confidence, language: classification.detectedLanguage,
      });
      await failAttempt(ctx, job, 'not_a_quote');
      return;
    }

    const extracted = await analyzer.extractQuote(fileUrl, mimeType, fileBuffer);

    // Extract logo BEFORE applyExtractedData so vendorLogoUrl is included in the single Firestore write —
    // avoids the race where the client reads the quote between applyExtractedData and a later logo patch.
    if (fileBuffer) {
      const logoUrl = await extractAndUploadVendorLogo(fileBuffer, mimeType, ctx.companyId, quoteId);
      if (logoUrl) {
        extracted.vendorLogoUrl = logoUrl;
        logger.info('Vendor logo extracted', { quoteId, logoUrl });
      }
    }

    await applyExtractedData(ctx, quoteId, extracted, { source: 'scan' });
    logger.info('Quote scan completed', {
      quoteId, attempt: job.attempt, overallConfidence: extracted.overallConfidence, lines: extracted.lineItems.length,
    });
    notifyScanCompleted(ctx, quoteId, extracted.vendorName?.value);
  } catch (error) {
    logger.error('Quote scan failed', { quoteId, attempt: job.attempt, error: getErrorMessage(error, 'Quote AI scan failed') });
    await failAttempt(ctx, job, 'analyzer_failed');
  }
}
