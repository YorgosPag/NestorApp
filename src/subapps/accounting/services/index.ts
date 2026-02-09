/**
 * @fileoverview Accounting Services — Factory & Barrel Exports
 * @description Factory function to instantiate the full accounting service stack
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.1.0
 * @see ADR-ACC-010 Portability & Abstraction Layers
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 *
 * NOTE: All imports are at the top to avoid duplicate import/re-export bindings
 * that cause TDZ errors ("Cannot access 'f' before initialization") during
 * Webpack minification in Vercel production builds.
 */

// ── Single import point for each module (used both by factory and re-exports)
import { AccountingService } from './accounting-service';
import { FirestoreAccountingRepository } from './repository/firestore-accounting-repository';
import { VATEngine } from './engines/vat-engine';
import { TaxEngine } from './engines/tax-engine';
import { DepreciationEngine } from './engines/depreciation-engine';
import { OpenAIDocumentAnalyzer, createOpenAIDocumentAnalyzer } from './external/openai-document-analyzer';
import { DocumentAnalyzerStub } from './external/document-analyzer.stub';
import type { IDocumentAnalyzer } from '../types/interfaces';

// ── Re-export Services, Repository, Engines ─────────────────────────────────
export {
  AccountingService,
  FirestoreAccountingRepository,
  VATEngine,
  TaxEngine,
  DepreciationEngine,
  OpenAIDocumentAnalyzer,
  createOpenAIDocumentAnalyzer,
  DocumentAnalyzerStub,
};

// ── Config ──────────────────────────────────────────────────────────────────
export {
  GREEK_VAT_RATES,
  getVatRateForDate,
  getVatDeductibilityRules,
  getMyDataVatCategory,
} from './config/vat-config';
export {
  GREEK_TAX_SCALES,
  getTaxScaleForYear,
  getAvailableTaxYears,
} from './config/tax-config';
export {
  DEPRECIATION_RATES,
  getDepreciationRate,
  calculateUsefulLife,
} from './config/depreciation-config';
export {
  EFKA_YEAR_CONFIGS,
  getEfkaConfigForYear,
  calculateMonthlyBreakdown,
  calculateAnnualTotal,
} from './config/efka-config';

// ── Helpers ─────────────────────────────────────────────────────────────────
export {
  sanitizeForFirestore,
  isoNow,
  isoToday,
  getQuarterFromDate,
  getFiscalYearFromDate,
} from './repository/firestore-helpers';

// ── Types (re-export from types for convenience) ────────────────────────────
export type {
  IAccountingRepository,
  IVATEngine,
  ITaxEngine,
  IDepreciationEngine,
  IMatchingEngine,
  IMyDataService,
  ICSVImportService,
  IDocumentAnalyzer,
} from '../types/interfaces';

// ============================================================================
// FACTORY — Instantiate Full Accounting Service Stack
// ============================================================================

/**
 * Δημιουργία πλήρους stack λογιστικών services
 *
 * Factory pattern — instantiates repository, engines, and orchestrator.
 *
 * @example
 * ```typescript
 * const { service, repository, vatEngine, taxEngine, depreciationEngine } = createAccountingServices();
 *
 * // Use the orchestrator
 * const vatSummary = await service.getVATQuarterDashboard(2026, 1);
 *
 * // Or use individual engines
 * const vatCalc = vatEngine.calculateOutputVat(1000, 24);
 * ```
 */
export function createAccountingServices() {
  const repository = new FirestoreAccountingRepository();
  const vatEngine = new VATEngine(repository);
  const taxEngine = new TaxEngine(repository);
  const depreciationEngine = new DepreciationEngine(repository);
  const service = new AccountingService(repository, vatEngine, taxEngine, depreciationEngine);

  // AI Document Analyzer: use OpenAI if API key is configured, otherwise stub
  const documentAnalyzer: IDocumentAnalyzer = createOpenAIDocumentAnalyzer() ?? new DocumentAnalyzerStub();

  return {
    service,
    repository,
    vatEngine,
    taxEngine,
    depreciationEngine,
    documentAnalyzer,
  };
}
