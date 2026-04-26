/**
 * Quote Analyzer interface — ADR-327 §6 (AI Extraction Strategy, Phase 2).
 *
 * Mirrors `IDocumentAnalyzer` (accounting subapp) but specialized for quotes.
 * Implementations: `OpenAIQuoteAnalyzer` (real) + `QuoteAnalyzerStub` (fallback).
 */

import type { ExtractedQuoteData } from './quote';

export interface QuoteClassification {
  isQuote: boolean;
  confidence: number;
  detectedLanguage: string;
}

export interface IQuoteAnalyzer {
  classifyQuote(fileUrl: string, mimeType: string, fileBuffer?: Buffer): Promise<QuoteClassification>;
  extractQuote(fileUrl: string, mimeType: string, fileBuffer?: Buffer): Promise<ExtractedQuoteData>;
}
