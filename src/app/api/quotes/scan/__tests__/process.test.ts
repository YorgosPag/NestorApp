/**
 * ΑΓΚΥΡΑ — **κάθε προσπάθεια σάρωσης τελειώνει με ρητή κατάσταση** (ADR-327 §6.10, 2026-11-03).
 *
 * Πριν: «δεν είναι προσφορά» και σφάλμα αναλυτή έγραφαν ΜΟΝΟ ωμό ελληνικό κείμενο στο `notes` ⇒ η οθόνη έμενε
 * σε spinner για πάντα. Τώρα: επιτυχία = `applyExtractedData` (δεδομένα + `succeeded` μαζί)· αποτυχία = κωδικός,
 * με τον αριθμό της ΣΩΣΤΗΣ προσπάθειας (fencing token).
 */

/* global describe, it, expect, beforeEach, jest */

import type { AuthContext } from '@/lib/auth';
import type { IQuoteAnalyzer } from '@/subapps/procurement/types/quote-analyzer';
import { applyExtractedData } from '@/subapps/procurement/services/quote-service';
import { markQuoteExtractionFailed } from '@/subapps/procurement/services/quote-extraction-lifecycle';
import { processScanAsync } from '../process';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/subapps/procurement/services/quote-service', () => ({ applyExtractedData: jest.fn().mockResolvedValue({}) }));
jest.mock('@/subapps/procurement/services/quote-extraction-lifecycle', () => ({
  markQuoteExtractionFailed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/subapps/procurement/services/logo-extractor', () => ({ extractAndUploadVendorLogo: jest.fn().mockResolvedValue(null) }));
jest.mock('@/subapps/procurement/services/external/openai-quote-analyzer', () => ({ createOpenAIQuoteAnalyzer: () => null }));
jest.mock('@/subapps/procurement/services/external/quote-analyzer.stub', () => ({ QuoteAnalyzerStub: jest.fn() }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchProcurementNotification: jest.fn() }));
jest.mock('@/server/notifications/notification-title', () => ({ notificationFallbackTitle: () => 'title' }));

const apply = applyExtractedData as jest.MockedFunction<typeof applyExtractedData>;
const fail = markQuoteExtractionFailed as jest.MockedFunction<typeof markQuoteExtractionFailed>;
const ctx = { uid: 'u_1', companyId: 'co_1' } as unknown as AuthContext;
const job = { quoteId: 'qt_1', fileUrl: 'https://x/f.pdf', mimeType: 'application/pdf', attempt: 3 };

function analyzer(over: Partial<IQuoteAnalyzer>): IQuoteAnalyzer {
  return {
    classifyQuote: jest.fn().mockResolvedValue({ isQuote: true, confidence: 90, detectedLanguage: 'el' }),
    extractQuote: jest.fn().mockResolvedValue({ overallConfidence: 88, lineItems: [], vendorName: { value: 'ACME' } }),
    ...over,
  } as unknown as IQuoteAnalyzer;
}

beforeEach(() => {
  apply.mockClear();
  fail.mockClear();
});

describe('processScanAsync — έκβαση κάθε προσπάθειας', () => {
  it('Σ1 — επιτυχία ⇒ applyExtractedData, ΚΑΜΙΑ σήμανση αποτυχίας', async () => {
    await processScanAsync(ctx, job, analyzer({}));
    expect(apply).toHaveBeenCalledWith(ctx, 'qt_1', expect.objectContaining({ overallConfidence: 88 }), { source: 'scan' });
    expect(fail).not.toHaveBeenCalled();
  });

  it.each([
    ['δεν είναι προσφορά', { isQuote: false, confidence: 95 }],
    ['χαμηλή βεβαιότητα', { isQuote: true, confidence: 29 }],
  ])('Σ2 — %s ⇒ failed/not_a_quote με τον αριθμό της προσπάθειας', async (_label, classification) => {
    await processScanAsync(ctx, job, analyzer({ classifyQuote: jest.fn().mockResolvedValue({ ...classification, detectedLanguage: 'el' }) }));
    expect(fail).toHaveBeenCalledWith(ctx, 'qt_1', 'not_a_quote', 3);
    expect(apply).not.toHaveBeenCalled();
  });

  it('Σ3 — σφάλμα αναλυτή ⇒ failed/analyzer_failed (όχι κείμενο στο `notes`)', async () => {
    await processScanAsync(ctx, job, analyzer({ extractQuote: jest.fn().mockRejectedValue(new Error('timeout')) }));
    expect(fail).toHaveBeenCalledWith(ctx, 'qt_1', 'analyzer_failed', 3);
  });

  it('Σ4 — αποτυχία της ίδιας της σήμανσης δεν πετά έξω από το `after()`', async () => {
    fail.mockRejectedValueOnce(new Error('firestore down'));
    await expect(
      processScanAsync(ctx, job, analyzer({ extractQuote: jest.fn().mockRejectedValue(new Error('x')) })),
    ).resolves.toBeUndefined();
  });
});
