/**
 * @fileoverview Document Analyzer Stub — Placeholder for AI Document Processing
 * @description Stub implementation — placeholder for OpenAI Vision integration
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-005 AI Document Processing
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { IDocumentAnalyzer } from '../../types/interfaces';
import type { DocumentClassification, DocumentType } from '../../types/documents';
import type { ExtractedDocumentData } from '../../types/documents';
import type { ExpenseCategory } from '../../types/common';

// ============================================================================
// DOCUMENT ANALYZER STUB
// ============================================================================

const NOT_CONFIGURED_MSG = '[DocumentAnalyzer] Η AI ανάλυση εγγράφων δεν έχει ρυθμιστεί. Θα ενεργοποιηθεί με OpenAI Vision integration.';

/**
 * Document Analyzer Stub
 *
 * Placeholder implementation — returns basic/empty results
 * until the OpenAI Vision integration is activated.
 *
 * Will be replaced with a real AI-powered implementation that:
 * - Uses OpenAI gpt-4o for OCR+NLP
 * - Extracts structured data from invoice images/PDFs
 * - Classifies documents by type and expense category
 * - Learns vendor→category mappings over time
 */
export class DocumentAnalyzerStub implements IDocumentAnalyzer {

  async classifyDocument(
    _fileUrl: string,
    _mimeType: string
  ): Promise<DocumentClassification> {
    throw new Error(NOT_CONFIGURED_MSG);
  }

  async extractData(
    _fileUrl: string,
    _documentType: DocumentType
  ): Promise<ExtractedDocumentData> {
    throw new Error(NOT_CONFIGURED_MSG);
  }

  async categorizeExpense(
    _issuerVatNumber: string,
    _description: string
  ): Promise<ExpenseCategory | null> {
    throw new Error(NOT_CONFIGURED_MSG);
  }
}
