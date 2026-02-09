/**
 * @fileoverview Accounting Services — Barrel Exports
 * @description Pure re-exports only — NO local import bindings
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 2.0.0
 * @see ADR-ACC-010 Portability & Abstraction Layers
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 *
 * ARCHITECTURE NOTE:
 * The factory function lives in a SEPARATE module (create-accounting-services.ts)
 * to avoid duplicate import/re-export bindings that cause TDZ errors
 * ("Cannot access 'f' before initialization") during Webpack minification.
 */

// ── Factory ─────────────────────────────────────────────────────────────────
export { createAccountingServices } from './create-accounting-services';

// ── Services ────────────────────────────────────────────────────────────────
export { AccountingService } from './accounting-service';

// ── Repository ──────────────────────────────────────────────────────────────
export { FirestoreAccountingRepository } from './repository/firestore-accounting-repository';

// ── Engines ─────────────────────────────────────────────────────────────────
export { VATEngine } from './engines/vat-engine';
export { TaxEngine } from './engines/tax-engine';
export { DepreciationEngine } from './engines/depreciation-engine';

// ── External Services ───────────────────────────────────────────────────────
// NOTE: OpenAIDocumentAnalyzer + DocumentAnalyzerStub are NOT re-exported here.
// They are only consumed by create-accounting-services.ts internally.
// Re-exporting them while the factory also imports them creates a diamond
// dependency → TDZ error in Webpack ("Cannot access 'f' before initialization").

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
