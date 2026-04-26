/**
 * Quote Analyzer Stub — ADR-327 §6 (AI Extraction Strategy, Phase 2).
 *
 * Fallback when `OPENAI_API_KEY` not configured. Throws NOT_CONFIGURED
 * so callers degrade gracefully (catch + mark quote `under_review` for manual entry).
 */

import type { IQuoteAnalyzer, QuoteClassification } from '../../types/quote-analyzer';
import type { ExtractedQuoteData } from '../../types/quote';

const NOT_CONFIGURED_MSG =
  '[QuoteAnalyzer] Η AI ανάλυση προσφορών δεν έχει ρυθμιστεί. Ορίστε OPENAI_API_KEY για ενεργοποίηση.';

export class QuoteAnalyzerStub implements IQuoteAnalyzer {
  async classifyQuote(_fileUrl: string, _mimeType: string, _fileBuffer?: Buffer): Promise<QuoteClassification> {
    throw new Error(NOT_CONFIGURED_MSG);
  }

  async extractQuote(_fileUrl: string, _mimeType: string, _fileBuffer?: Buffer): Promise<ExtractedQuoteData> {
    throw new Error(NOT_CONFIGURED_MSG);
  }
}
